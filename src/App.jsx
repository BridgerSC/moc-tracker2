import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Settings2, Users, Layers, Zap, Clock, Type, RotateCcw, Download, Check, CheckCircle } from 'lucide-react';

// --- GIST CONFIGURATION ---
const GIST_RAW_URL = "https://gist.githubusercontent.com/BridgerSC/f3b1a82c99def062fd2747eb5ddb16b8/raw/data.json"; 

// --- Infinite Timeline Constants ---
const BASE_DAY_WIDTH = 40; 
const ROW_HEIGHT = 52; 
const TOTAL_DAYS = 7300; 
const CENTER_DAY = 3650; 
const CANVAS_HEIGHT = 500; 
const MIN_DURATION_DAYS = 1; 

const PALETTE = [
  'bg-[#FFD166]', 'bg-[#06D6A0]', 'bg-[#118AB2]', 'bg-[#EF476F]', 
  'bg-[#A06CD5]', 'bg-[#4D908E]', 'bg-[#F77F00]', 'bg-[#EAE2B7]'
];

const INITIAL_EMPLOYEES = [
  { id: 'e1', name: 'Writing', color: 'bg-[#FFD166]' },
  { id: 'e2', name: 'Review', color: 'bg-[#06D6A0]' },
  { id: 'e3', name: 'Shoot', color: 'bg-[#118AB2]' },
  { id: 'e4', name: 'Edit', color: 'bg-[#EF476F]' },
];

const INITIAL_TASKS = [
  { id: 't1', empId: 'e1', start: -2, duration: 5, y: ROW_HEIGHT * 1, title: 'Project Alpha Script', arrayCount: 1, arrayOffset: 0, overrides: {}, rippleOffsets: [], status: 'todo' },
  { id: 't2', empId: 'e2', start: 4, duration: 3, y: ROW_HEIGHT * 1, title: 'Review Pass', arrayCount: 3, arrayOffset: 2, overrides: {}, rippleOffsets: [], status: 'todo' },
  { id: 't3', empId: 'e3', start: 20, duration: 10, y: ROW_HEIGHT * 2, title: 'Studio Shoot', arrayCount: 1, arrayOffset: 0, overrides: {}, rippleOffsets: [], status: 'todo' },
];

const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default function App() {
  const [zoom, setZoom] = useState(1);
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  
  const [selectedBlock, setSelectedBlock] = useState(null); 
  const [inlineEditId, setInlineEditId] = useState(null); 
  const [activeTab, setActiveTab] = useState('inspector'); 
  const [viewport, setViewport] = useState({ scrollLeft: 0, width: 1000 });
  const [copied, setCopied] = useState(false);
  
  const containerRef = useRef(null);
  const rulerRef = useRef(null);
  const zoomRef = useRef(zoom);
  const scrollUpdateRef = useRef(false);
  const pendingScrollRef = useRef(null);

  // --- Time & Reactivity ---
  const todayAtMidnight = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const [currentExactOffsetDays, setCurrentExactOffsetDays] = useState(
    (Date.now() - todayAtMidnight.getTime()) / 86400000
  );

  // Live "Now" marker update (polls every 60s)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExactOffsetDays((Date.now() - todayAtMidnight.getTime()) / 86400000);
    }, 60000);
    return () => clearInterval(interval);
  }, [todayAtMidnight]);

  // --- Startup Data Fetch ---
  useEffect(() => {
    if (!GIST_RAW_URL) return;
    fetch(GIST_RAW_URL)
      .then(res => res.json())
      .then(data => {
        if (data.employees) setEmployees(data.employees);
        if (data.tasks) setTasks(data.tasks);
      })
      .catch(err => console.error("Failed to load timeline data:", err));
  }, []);

  const handleExportJSON = () => {
    const data = JSON.stringify({ employees, tasks }, null, 2);
    const textArea = document.createElement("textarea");
    textArea.value = data;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
    document.body.removeChild(textArea);
  };

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useLayoutEffect(() => {
    if (pendingScrollRef.current !== null && containerRef.current) {
      containerRef.current.scrollLeft = pendingScrollRef.current;
      if (rulerRef.current) rulerRef.current.scrollLeft = pendingScrollRef.current;
      setViewport(v => ({ ...v, scrollLeft: pendingScrollRef.current }));
      pendingScrollRef.current = null;
    }
  }, [zoom]);

  // Initial Centering (Run ONLY on mount to prevent zoom snapping)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const centerPx = (CENTER_DAY + currentExactOffsetDays) * BASE_DAY_WIDTH * zoom;
    container.scrollLeft = centerPx - (container.clientWidth / 2);
    setViewport({ scrollLeft: container.scrollLeft, width: container.clientWidth });

    const obs = new ResizeObserver(entries => setViewport(v => ({ ...v, width: entries[0].contentRect.width })));
    obs.observe(container);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // --- Core Interactions: Pan & Zoom ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.shiftKey) {
        e.preventDefault(); 
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        const zoomFactor = delta > 0 ? 0.9 : 1.1; 
        let newZoom = Math.max(0.01, Math.min(zoomRef.current * zoomFactor, 3));

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const scrollX = container.scrollLeft;

        const timeAtMouse = (scrollX + mouseX) / zoomRef.current;
        const newScrollX = (timeAtMouse * newZoom) - mouseX;

        pendingScrollRef.current = newScrollX; 
        setZoom(newZoom);
      }
    };

    let isPanning = false; let startX = 0; let startY = 0; let scrollLeftStart = 0; let scrollTopStart = 0;

    const handleMouseDown = (e) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) { 
        e.preventDefault(); isPanning = true; startX = e.clientX; startY = e.clientY;
        scrollLeftStart = container.scrollLeft; scrollTopStart = container.scrollTop;
        document.body.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e) => {
      if (!isPanning) return;
      const newScrollX = scrollLeftStart - (e.clientX - startX);
      const newScrollY = scrollTopStart - (e.clientY - startY);
      container.scrollLeft = newScrollX; container.scrollTop = newScrollY;
      if (rulerRef.current) rulerRef.current.scrollLeft = newScrollX;
    };

    const handleMouseUp = () => { if (isPanning) { isPanning = false; document.body.style.cursor = ''; } };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('wheel', handleWheel); container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, []);

  const handleScroll = (e) => {
    if (rulerRef.current) rulerRef.current.scrollLeft = e.target.scrollLeft;
    if (!scrollUpdateRef.current) {
      scrollUpdateRef.current = true;
      requestAnimationFrame(() => { setViewport(v => ({ ...v, scrollLeft: e.target.scrollLeft })); scrollUpdateRef.current = false; });
    }
  };

  // --- Render Array Engine (Procedural Base + Ripple Deltas) ---
  const renderBlocks = useMemo(() => {
    const blocks = [];
    tasks.forEach(task => {
      const count = Math.max(1, task.arrayCount || 1);
      const offset = task.arrayOffset || 0;
      const rippleOffsets = task.rippleOffsets || [];

      for (let i = 0; i < count; i++) {
        const ovr = (task.overrides && task.overrides[i]) || {};
        
        if (ovr.deleted) continue; 
        
        const baseStart = task.start + i * (task.duration + offset);
        
        const cumulativeRipple = rippleOffsets
          .filter(r => r.fromIndex <= i)
          .reduce((sum, r) => sum + r.delta, 0);
        
        const deltaStart = ovr.deltaStart || 0;
        const blockStart = baseStart + deltaStart + cumulativeRipple;
        const duration = ovr.duration !== undefined ? ovr.duration : task.duration;
        const title = ovr.title !== undefined ? ovr.title : task.title;
        const blockY = ovr.y !== undefined ? ovr.y : task.y;
        const status = ovr.status !== undefined ? ovr.status : (i === 0 ? (task.status || 'todo') : 'todo');

        blocks.push({
          renderId: `${task.id}-${i}`,
          taskId: task.id,
          childIndex: i,
          start: blockStart,
          baseStart: baseStart,
          deltaStart: deltaStart,
          cumulativeRipple: cumulativeRipple,
          duration: duration,
          y: blockY,
          title: title,
          empId: task.empId,
          status: status,
          isChild: i > 0,
          hasStartOverride: (ovr.deltaStart !== undefined && ovr.deltaStart !== 0) || cumulativeRipple !== 0,
          hasYOverride: ovr.y !== undefined
        });
      }
    });
    return blocks;
  }, [tasks]);

  const ticks = useMemo(() => {
    const dayWidth = BASE_DAY_WIDTH * zoom;
    const { scrollLeft, width } = viewport;
    const buffer = width * 2;
    const startPx = Math.max(0, scrollLeft - buffer);
    const endPx = scrollLeft + width + buffer;
    const startDayIndex = Math.floor(startPx / dayWidth);
    const endDayIndex = Math.ceil(endPx / dayWidth);
    const activeTicks = [];
    
    let interval = 'day';
    if (zoom <= 0.03) interval = 'year';
    else if (zoom <= 0.15) interval = 'month';
    else if (zoom <= 0.6) interval = 'week';

    const startDate = new Date(todayAtMidnight); startDate.setDate(startDate.getDate() + (startDayIndex - CENTER_DAY));
    const endDate = new Date(todayAtMidnight); endDate.setDate(endDate.getDate() + (endDayIndex - CENTER_DAY));
    let current = new Date(startDate);

    if (interval === 'week') current.setDate(current.getDate() - current.getDay());
    else if (interval === 'month') current.setDate(1);
    else if (interval === 'year') current.setMonth(0, 1);

    while (current <= endDate) {
      const diffDays = Math.round((current.getTime() - todayAtMidnight.getTime()) / 86400000);
      const targetIndex = CENTER_DAY + diffDays;

      if (targetIndex >= startDayIndex && targetIndex <= endDayIndex) {
        let label = ''; let isMajor = false;
        if (interval === 'year') { label = current.getFullYear().toString(); isMajor = true; } 
        else if (interval === 'month') { label = `${monthNames[current.getMonth()]} '${current.getFullYear().toString().slice(2)}`; isMajor = current.getMonth() === 0; } 
        else if (interval === 'week') { label = `${monthNames[current.getMonth()]} ${current.getDate()}`; isMajor = current.getDate() <= 7; } 
        else if (interval === 'day') { if (current.getDate() === 1) { label = `${monthNames[current.getMonth()]} 1`; isMajor = true; } else { label = current.getDate().toString(); } }
        activeTicks.push({ id: targetIndex, x: targetIndex * dayWidth, label, isMajor });
      }

      if (interval === 'day') current.setDate(current.getDate() + 1);
      else if (interval === 'week') current.setDate(current.getDate() + 7);
      else if (interval === 'month') current.setMonth(current.getMonth() + 1);
      else if (interval === 'year') current.setFullYear(current.getFullYear() + 1);
    }
    return activeTicks;
  }, [zoom, viewport.scrollLeft, viewport.width, todayAtMidnight]);

  // --- Math Helpers ---
  const getTaskLeftPx = (startDaysOffset) => (CENTER_DAY + startDaysOffset) * BASE_DAY_WIDTH * zoomRef.current;
  const getTaskStartFromPx = (px) => (px / (BASE_DAY_WIDTH * zoomRef.current)) - CENTER_DAY;
  const offsetToDateString = (offset) => {
    const d = new Date(todayAtMidnight.getTime() + offset * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dateStringToOffset = (dateStr) => {
    if (!dateStr) return NaN;
    const [y, m, d] = dateStr.split('-');
    return Math.round((new Date(y, m - 1, d).getTime() - todayAtMidnight.getTime()) / 86400000);
  };

  // --- Data Operations ---
  const updateTaskField = (taskId, childIndex, field, value) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      
      if (field === 'RESET_ALL') {
        return { ...t, overrides: {}, rippleOffsets: [] };
      }
      if (field === 'RESET_CHILD') {
        const overrides = { ...t.overrides };
        delete overrides[childIndex];
        return { ...t, overrides };
      }

      if (childIndex === 0 && (field === 'y' || field === 'empId' || field === 'arrayCount' || field === 'arrayOffset' || field === 'start' || field === 'duration' || field === 'title' || field === 'status')) {
        return { ...t, [field]: value };
      }

      const overrides = { ...t.overrides };
      overrides[childIndex] = { ...(overrides[childIndex] || {}), [field]: value };
      return { ...t, overrides };
    }));
  };

  const selectNode = (taskId, childIndex) => { setSelectedBlock({ id: taskId, index: childIndex }); setActiveTab('inspector'); };

  const handleCanvasDoubleClick = (e) => {
    if (e.target !== e.currentTarget) return;
    const clickX = e.clientX - e.currentTarget.getBoundingClientRect().left + containerRef.current.scrollLeft;
    const clickY = e.clientY - e.currentTarget.getBoundingClientRect().top + containerRef.current.scrollTop;
    const newTask = {
      id: `t_${Date.now()}`, empId: employees.length > 0 ? employees[0].id : null, 
      start: Math.floor(getTaskStartFromPx(clickX)), duration: 5, y: Math.floor(clickY / ROW_HEIGHT) * ROW_HEIGHT,
      title: 'New Event', arrayCount: 1, arrayOffset: 0, overrides: {}, rippleOffsets: [], status: 'todo'
    };
    setTasks([...tasks, newTask]);
    selectNode(newTask.id, 0);
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return; 

        if (selectedBlock) {
          if (selectedBlock.index === 0) {
            setTasks(prev => prev.filter(t => t.id !== selectedBlock.id));
          } else {
            setTasks(prev => prev.map(t => {
              if (t.id !== selectedBlock.id) return t;
              const overrides = { ...t.overrides };
              overrides[selectedBlock.index] = { ...(overrides[selectedBlock.index] || {}), deleted: true };
              return { ...t, overrides };
            }));
          }
          setSelectedBlock(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlock]);

  // --- Live Drag Handlers (Ripple + Independent Arrays) ---
  const handleBlockMouseDown = (e, block) => {
    if (e.button !== 0 || e.altKey) return; 
    e.stopPropagation(); selectNode(block.taskId, block.childIndex);

    const isRipple = e.shiftKey;
    const startX = e.clientX; const startY = e.clientY;
    const initialLeft = getTaskLeftPx(block.start);
    const initialTop = block.y;
    
    const allNodes = Array.from(document.querySelectorAll('.task-block'));
    const movingInitials = [];

    allNodes.forEach(n => {
      const nTaskId = n.dataset.taskFamily;
      const nChildIdx = parseInt(n.dataset.childIndex);
      const nOriginalStart = parseFloat(n.dataset.originalStart);
      const nHasYOverride = n.dataset.hasYOverride === 'true';

      let shouldMoveX = false; let shouldMoveY = false;

      if (nTaskId === block.taskId && nChildIdx === block.childIndex) {
         shouldMoveX = true; shouldMoveY = true;
      } else if (!isRipple) {
         if (!block.isChild && nTaskId === block.taskId) {
            shouldMoveX = true; shouldMoveY = !nHasYOverride; 
         }
      } else if (isRipple) {
         if (!block.isChild && nTaskId === block.taskId) {
            shouldMoveX = true; shouldMoveY = !nHasYOverride;
         } else if (block.isChild && nTaskId === block.taskId && nChildIdx > block.childIndex) {
            shouldMoveX = true; 
         }
         if (nTaskId !== block.taskId && nOriginalStart >= block.start) {
            shouldMoveX = true;
         }
      }

      if (shouldMoveX || shouldMoveY) {
         movingInitials.push({ node: n, left: parseFloat(n.style.left), top: parseFloat(n.style.top), shouldMoveX, shouldMoveY });
      }
    });

    let finalStart = block.start; let finalY = block.y;

    const handleMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      finalY = Math.round(Math.max(0, initialTop + (moveEvent.clientY - startY)) / ROW_HEIGHT) * ROW_HEIGHT;
      finalStart = Math.round(getTaskStartFromPx(initialLeft + deltaX));
      
      const snappedDeltaPx = (finalStart - block.start) * BASE_DAY_WIDTH * zoomRef.current;
      const deltaYPx = finalY - initialTop;

      movingInitials.forEach(item => {
        if (item.shouldMoveX) item.node.style.left = `${item.left + snappedDeltaPx}px`;
        if (item.shouldMoveY) item.node.style.top = `${item.top + deltaYPx}px`;
      });
    };

    const handleUp = () => {
      const deltaDays = finalStart - block.start;

      if (deltaDays !== 0 || finalY !== initialTop) {
        setTasks(prev => prev.map(t => {
          let newT = { ...t };
          
          if (t.id === block.taskId) {
            if (!block.isChild) {
               newT.start = finalStart;
               if (finalY !== block.y) newT.y = finalY; 
               if (isRipple) newT.rippleOffsets = [...(newT.rippleOffsets || []), { fromIndex: 1, delta: deltaDays }];
            } else {
               const ovr = { ...newT.overrides };
               const childOvr = { ...(ovr[block.childIndex] || {}), deltaStart: block.deltaStart + deltaDays };
               if (finalY !== block.y) childOvr.y = finalY; 
               ovr[block.childIndex] = childOvr;
               newT.overrides = ovr;

               if (isRipple) newT.rippleOffsets = [...(newT.rippleOffsets || []), { fromIndex: block.childIndex + 1, delta: deltaDays }];
            }
          }

          const rippleThreshold = Math.min(block.start, finalStart);

          if (isRipple && t.id !== block.taskId) {
             if (t.start >= rippleThreshold) {
                newT.start += deltaDays;
             } else {
                const firstAffectedChildIdx = renderBlocks.find(b => b.taskId === t.id && b.start >= rippleThreshold)?.childIndex;
                if (firstAffectedChildIdx !== undefined && firstAffectedChildIdx > 0) {
                   newT.rippleOffsets = [...(newT.rippleOffsets || []), { fromIndex: firstAffectedChildIdx, delta: deltaDays }];
                }
             }
          }
          return newT;
        }));
      }
      window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
  };

  const handleResizeRight = (e, block) => {
    e.stopPropagation(); selectNode(block.taskId, block.childIndex);
    const isRipple = e.shiftKey;
    const startX = e.clientX;
    const taskElement = e.currentTarget.parentElement;
    
    const originalDuration = block.duration;
    const originalEndDay = block.start + originalDuration;
    
    const allNodes = Array.from(document.querySelectorAll('.task-block'));
    const movingInitials = [];

    allNodes.forEach(n => {
      const nTaskId = n.dataset.taskFamily;
      const nChildIdx = parseInt(n.dataset.childIndex);
      const nOriginalStart = parseFloat(n.dataset.originalStart);
      
      let moveRatio = 0; let flatMove = false;

      if (nTaskId === block.taskId && nChildIdx === block.childIndex) {
      } else if (!isRipple) {
         if (!block.isChild && nTaskId === block.taskId && nChildIdx > 0) {
            moveRatio = nChildIdx; 
         }
      } else if (isRipple) {
         if (!block.isChild && nTaskId === block.taskId && nChildIdx > 0) {
            moveRatio = nChildIdx; 
         } else if (block.isChild && nTaskId === block.taskId && nChildIdx > block.childIndex) {
            flatMove = true; 
         }
         if (nTaskId !== block.taskId && nOriginalStart >= originalEndDay) {
            flatMove = true;
         }
      }

      if (moveRatio > 0 || flatMove) {
         movingInitials.push({ node: n, left: parseFloat(n.style.left), moveRatio: flatMove ? 1 : moveRatio });
      }
    });

    let finalDuration = block.duration;

    const handleMove = (moveEvent) => {
      const deltaDays = (moveEvent.clientX - startX) / (BASE_DAY_WIDTH * zoomRef.current);
      finalDuration = Math.max(MIN_DURATION_DAYS, Math.round(originalDuration + deltaDays));
      const snappedDeltaPx = (finalDuration - originalDuration) * BASE_DAY_WIDTH * zoomRef.current;

      taskElement.style.width = `${finalDuration * BASE_DAY_WIDTH * zoomRef.current}px`;
      movingInitials.forEach(item => { item.node.style.left = `${item.left + (item.moveRatio * snappedDeltaPx)}px`; });
    };

    const handleUp = () => {
      const deltaDays = finalDuration - originalDuration;
      
      if (deltaDays !== 0) {
        setTasks(prev => prev.map(t => {
          let newT = { ...t };
          if (t.id === block.taskId) {
            if (block.childIndex === 0) newT.duration = finalDuration;
            else {
               const ovr = { ...newT.overrides };
               ovr[block.childIndex] = { ...(ovr[block.childIndex] || {}), duration: finalDuration };
               newT.overrides = ovr;
            }

            if (isRipple) newT.rippleOffsets = [...(newT.rippleOffsets || []), { fromIndex: block.childIndex + 1, delta: deltaDays }];
          }

          const rippleThreshold = originalEndDay;

          if (isRipple && t.id !== block.taskId) {
             if (t.start >= rippleThreshold) {
                newT.start += deltaDays;
             } else {
                const firstAffectedChildIdx = renderBlocks.find(b => b.taskId === t.id && b.start >= rippleThreshold)?.childIndex;
                if (firstAffectedChildIdx !== undefined && firstAffectedChildIdx > 0) {
                   newT.rippleOffsets = [...(newT.rippleOffsets || []), { fromIndex: firstAffectedChildIdx, delta: deltaDays }];
                }
             }
          }
          return newT;
        }));
      }
      window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
  };

  const handleResizeLeft = (e, block) => {
    e.stopPropagation(); selectNode(block.taskId, block.childIndex);
    const startX = e.clientX; const taskElement = e.currentTarget.parentElement;
    const initialLeft = parseFloat(taskElement.style.left);
    
    const allNodes = Array.from(document.querySelectorAll('.task-block'));
    const movingInitials = [];

    allNodes.forEach(n => {
       const nTaskId = n.dataset.taskFamily;
       const nChildIdx = parseInt(n.dataset.childIndex);
       if (!block.isChild && nTaskId === block.taskId && nChildIdx > 0) {
          movingInitials.push({ node: n, left: parseFloat(n.style.left), moveRatio: (1 - nChildIdx) });
       }
    });

    let finalStart = block.start; let finalDuration = block.duration;

    const handleMove = (moveEvent) => {
      const deltaDays = Math.round((moveEvent.clientX - startX) / (BASE_DAY_WIDTH * zoomRef.current));
      finalDuration = Math.max(MIN_DURATION_DAYS, block.duration - deltaDays);
      finalStart = block.start + (block.duration - finalDuration);
      
      const actualDeltaPx = (finalStart - block.start) * BASE_DAY_WIDTH * zoomRef.current;

      taskElement.style.width = `${finalDuration * BASE_DAY_WIDTH * zoomRef.current}px`;
      taskElement.style.left = `${getTaskLeftPx(finalStart)}px`;
      
      movingInitials.forEach(item => { item.node.style.left = `${item.left + (item.moveRatio * actualDeltaPx)}px`; });
    };

    const handleUp = () => {
      setTasks(prev => prev.map(t => {
        if (t.id === block.taskId) {
           if (block.isChild) {
               const ovr = { ...t.overrides };
               ovr[block.childIndex] = {
                   ...(ovr[block.childIndex] || {}),
                   deltaStart: block.deltaStart + (finalStart - block.start),
                   duration: finalDuration
               };
               return { ...t, overrides: ovr };
           } else {
               return { ...t, start: finalStart, duration: finalDuration };
           }
        }
        return t;
      }));
      window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
  };

  const getFallbackEmployee = () => ({ name: 'Unassigned', role: '-', color: 'bg-[#666]' });
  const contentWidth = TOTAL_DAYS * BASE_DAY_WIDTH * zoom;
  const activeBlockData = selectedBlock ? renderBlocks.find(b => b.taskId === selectedBlock.id && b.childIndex === selectedBlock.index) : null;
  const parentTaskData = activeBlockData ? tasks.find(t => t.id === activeBlockData.taskId) : null;
  const nowPx = (CENTER_DAY + currentExactOffsetDays) * BASE_DAY_WIDTH * zoom;

  const hasAnyOverride = activeBlockData && activeBlockData.isChild && parentTaskData && (
    (parentTaskData.overrides && Object.keys(parentTaskData.overrides[activeBlockData.childIndex] || {}).length > 0) || 
    (parentTaskData.rippleOffsets && parentTaskData.rippleOffsets.some(r => r.fromIndex <= activeBlockData.childIndex))
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0e0e0e] text-[#e8e8e8] overflow-hidden select-none font-mono" style={{ colorScheme: 'dark' }}>
      
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&display=swap');
          .font-bebas { font-family: 'Bebas Neue', sans-serif; }
          .font-mono { font-family: 'DM Mono', monospace; }
          .brutal-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
          .brutal-scroll::-webkit-scrollbar-track { background: #0e0e0e; border-left: 1px solid #2a2a2a; border-top: 1px solid #2a2a2a;}
          .brutal-scroll::-webkit-scrollbar-thumb { background: #2a2a2a; }
          .brutal-scroll::-webkit-scrollbar-thumb:hover { background: #444; }
          input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        `}
      </style>

      <header className="h-[84px] bg-[#0e0e0e] flex items-center justify-between px-6 shrink-0 z-30 shadow-md">
        <div className="flex items-baseline gap-4">
          <h1 className="font-bebas text-5xl tracking-[3px] text-white leading-none m-0">PROJECT CAL</h1>
          <span className="text-[11px] text-[#666] tracking-[2px] uppercase hidden sm:block">Infinite Production Tracker</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-[#666] tracking-[1px] uppercase border border-[#2a2a2a] px-3 py-1.5 bg-[#161616] flex gap-4 hidden md:flex">
            <span>Shift+Drag: Ripple</span>
            <span>MMB: Pan</span>
            <span>Dbl Click: Edit/Add</span>
          </div>
          <button 
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] border border-[#444] rounded-[3px] text-[10px] text-white uppercase tracking-[1px] transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Download size={12} />}
            {copied ? 'Copied to Clipboard!' : 'Export JSON'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0e0e0e]">
          
          <div className="h-8 bg-[#161616] border-y border-[#2a2a2a] overflow-hidden shrink-0 pointer-events-none z-20" ref={rulerRef}>
            <div style={{ width: `${contentWidth}px` }} className="h-full relative">
              {ticks.map((tick) => (
                <div key={`ruler-${tick.id}`} className={`absolute h-full border-l flex items-center px-1.5 text-[9px] tracking-[1px] uppercase whitespace-nowrap ${tick.isMajor ? 'border-[#555] text-white font-bold' : 'border-[#2a2a2a] text-[#666]'}`} style={{ left: `${tick.x}px` }}>
                  {tick.label}
                </div>
              ))}
              <div className="absolute top-0 bottom-0 w-[1px] bg-red-600 z-30" style={{ left: `${nowPx}px` }}>
                <div className="absolute top-0 left-[-4px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-red-600" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto brutal-scroll relative" ref={containerRef} onScroll={handleScroll} onClick={(e) => { if(e.target === e.currentTarget) { setSelectedBlock(null); setInlineEditId(null); } }}>
            <div style={{ width: `${contentWidth}px`, height: `${CANVAS_HEIGHT}px` }} className="relative" onDoubleClick={handleCanvasDoubleClick}>
              
              {ticks.map((tick) => (
                <div key={`grid-${tick.id}`} className="absolute top-0 bottom-0 pointer-events-none border-l border-[#2a2a2a]" style={{ left: `${tick.x}px`, opacity: tick.isMajor ? 1 : 0.4 }} />
              ))}

              <div className="absolute inset-0 pointer-events-none" style={{ backgroundSize: `100% ${ROW_HEIGHT}px`, backgroundImage: `linear-gradient(to bottom, #2a2a2a 1px, transparent 1px)` }} />
              <div className="absolute top-0 bottom-0 w-[1px] bg-red-600/60 shadow-[0_0_8px_rgba(220,38,38,0.4)] z-0 pointer-events-none" style={{ left: `${nowPx}px` }} />

              {renderBlocks.map(block => {
                const emp = employees.find(e => e.id === block.empId) || getFallbackEmployee();
                const isSelected = selectedBlock?.id === block.taskId && selectedBlock?.index === block.childIndex;
                const blockWidth = block.duration * BASE_DAY_WIDTH * zoom;
                
                return (
                  <div
                    key={block.renderId}
                    data-render-id={block.renderId}
                    data-task-family={block.taskId}
                    data-child-index={block.childIndex}
                    data-original-start={block.start}
                    data-has-start-override={block.hasStartOverride.toString()}
                    data-has-y-override={block.hasYOverride.toString()}
                    onMouseDown={(e) => handleBlockMouseDown(e, block)}
                    className={`task-block absolute rounded-[3px] ${emp.color} overflow-hidden flex flex-col justify-center px-2 cursor-grab active:cursor-grabbing border transition-[border-color,opacity] ${isSelected ? 'border-white !z-10 opacity-100' : 'border-transparent opacity-90 hover:opacity-100'} ${block.isChild && (block.hasStartOverride || block.hasYOverride) ? 'border-solid border-white/50' : block.isChild ? 'border-dashed border-white/30' : ''}`}
                    style={{
                      left: `${getTaskLeftPx(block.start)}px`, top: `${block.y + 6}px`, 
                      height: `${ROW_HEIGHT - 12}px`, width: `${blockWidth}px`, minWidth: '4px'
                    }}
                  >
                    <div onMouseDown={(e) => handleResizeLeft(e, block)} className="absolute inset-y-0 left-0 w-2.5 hover:bg-white/30 cursor-ew-resize z-10" />
                    <div onMouseDown={(e) => handleResizeRight(e, block)} className="absolute inset-y-0 right-0 w-2.5 hover:bg-white/30 cursor-ew-resize z-10" />
                    
                    {/* Status Badge */}
                    {block.status && block.status !== 'todo' && (
                      blockWidth > 40 ? (
                        <div className="absolute top-1 right-1 border px-1 py-[1px] text-[7px] font-bold uppercase tracking-[1px] bg-[#0e0e0e]"
                             style={{
                               borderColor: block.status === 'done' ? '#06D6A0' : block.status === 'late' ? '#EF476F' : '#118AB2',
                               color: block.status === 'done' ? '#06D6A0' : block.status === 'late' ? '#EF476F' : '#118AB2'
                             }}>
                          {block.status === 'done' ? 'DONE' : block.status === 'late' ? 'LATE' : 'PROG'}
                        </div>
                      ) : (
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full border border-[#0e0e0e]"
                             style={{
                               backgroundColor: block.status === 'done' ? '#06D6A0' : block.status === 'late' ? '#EF476F' : '#118AB2',
                             }}
                        />
                      )
                    )}

                    {blockWidth > 40 && (
                      <div className="pointer-events-auto z-20 flex flex-col w-full overflow-hidden" onDoubleClick={(e) => { e.stopPropagation(); setInlineEditId(block.renderId); }}>
                        {inlineEditId === block.renderId ? (
                          <input
                            autoFocus
                            defaultValue={block.title}
                            onBlur={(e) => { updateTaskField(block.taskId, block.childIndex, 'title', e.target.value); setInlineEditId(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className="bg-transparent border-none outline-none text-[11px] font-bold text-white w-full placeholder:text-white/30 p-0 m-0 leading-tight"
                            placeholder="Block Name"
                          />
                        ) : (
                          <div className="text-[11px] font-bold text-white tracking-[0.5px] uppercase truncate leading-tight pr-6">
                            {block.title}
                          </div>
                        )}
                        <div className="text-[9px] text-white/60 font-medium tracking-[1px] uppercase truncate leading-tight mt-[1px]">
                          {emp.name} {block.isChild && `(${block.childIndex + 1})`}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="w-[300px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shrink-0 z-20">
          <div className="flex border-b border-[#2a2a2a] shrink-0 h-8 bg-[#161616]">
            <button onClick={() => setActiveTab('team')} className={`flex-1 flex items-center justify-center text-[10px] font-medium uppercase tracking-[1px] transition-colors border-b ${activeTab === 'team' ? 'text-white border-white bg-[#0e0e0e]' : 'text-[#666] border-transparent hover:text-[#aaa]'}`}>Phases / Team</button>
            <button onClick={() => setActiveTab('inspector')} className={`flex-1 flex items-center justify-center text-[10px] font-medium uppercase tracking-[1px] transition-colors border-b border-l border-l-[#2a2a2a] ${activeTab === 'inspector' ? 'text-white border-b-white bg-[#0e0e0e]' : 'text-[#666] border-b-transparent hover:text-[#aaa]'}`}>Inspector</button>
          </div>

          <div className="flex-1 overflow-y-auto brutal-scroll flex flex-col">
            {activeTab === 'team' && (
              <div className="p-5 space-y-4">
                <div className="font-bebas text-[22px] tracking-[2px] text-[#aaa] flex items-center gap-2"><Users size={18}/> PHASES</div>
                <div className="flex flex-col gap-2.5">
                  {employees.map(emp => (
                    <div key={emp.id} className="bg-[#161616] border border-[#2a2a2a] p-[14px_16px] relative group">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2.5 h-2.5 rounded-[2px] shrink-0 ${emp.color}`} />
                        <span className="text-[11px] tracking-[1px] uppercase text-white font-medium">{emp.name || 'Unnamed'}</span>
                        <button onClick={() => setEmployees(prev => prev.filter(e => e.id !== emp.id))} className="ml-auto text-[#666] hover:text-[#a04040] text-[10px] uppercase opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                      <label className="text-[9px] tracking-[1.5px] uppercase text-[#666] block mb-1 mt-3">Phase Name</label>
                      <input type="text" value={emp.name} onChange={(e) => setEmployees(prev => prev.map(em => em.id === emp.id ? { ...em, name: e.target.value } : em))} className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e8e8e8] text-[12px] p-[5px_8px] outline-none focus:border-[#666] transition-colors"/>
                      <label className="text-[9px] tracking-[1.5px] uppercase text-[#666] block mb-1 mt-3">Color</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {PALETTE.map(colorClass => (
                          <button key={colorClass} onClick={() => setEmployees(prev => prev.map(em => em.id === emp.id ? { ...em, color: colorClass } : em))} className={`w-5 h-5 rounded-[2px] ${colorClass} ${emp.color === colorClass ? 'ring-1 ring-white ring-offset-2 ring-offset-[#161616]' : 'opacity-70 hover:opacity-100'} transition-all`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setEmployees([...employees, { id: `e_${Date.now()}`, name: 'New Phase', color: PALETTE[0] }])} className="w-full border border-[#2a2a2a] text-[#666] text-[11px] tracking-[1px] p-[8px_16px] mt-2 uppercase transition-colors hover:border-[#888] hover:text-white">+ Add Phase</button>
              </div>
            )}

            {activeTab === 'inspector' && (
              activeBlockData && parentTaskData ? (
                <div className="p-5 flex flex-col gap-5 h-full">
                  <div className="font-bebas text-[22px] tracking-[2px] text-[#aaa] flex items-center justify-between">
                    <span className="flex items-center gap-2"><Settings2 size={18}/> INSPECT</span>
                  </div>

                  <div>
                    <label className="text-[9px] tracking-[1.5px] uppercase text-[#666] block mb-1 flex justify-between">
                      <span>{activeBlockData.isChild ? `Custom Title (Child ${activeBlockData.childIndex + 1})` : 'Block Title'}</span>
                      {activeBlockData.isChild && <span className="text-[#a04040]">Override</span>}
                    </label>
                    <div className="flex">
                      <input type="text" value={activeBlockData.title} onChange={(e) => updateTaskField(activeBlockData.taskId, activeBlockData.childIndex, 'title', e.target.value)} className="flex-1 bg-[#0e0e0e] border border-[#2a2a2a] text-[#e8e8e8] text-[12px] p-[5px_8px] outline-none focus:border-[#666] transition-colors" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] tracking-[1.5px] uppercase text-[#666] block mb-1">Assigned Phase (Global)</label>
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto brutal-scroll">
                      {employees.map(emp => (
                        <button key={emp.id} onClick={() => updateTaskField(activeBlockData.taskId, 0, 'empId', emp.id)} className={`p-[8px_12px] border flex items-center gap-2 text-left transition-colors ${activeBlockData.empId === emp.id ? 'border-[#888] bg-[#222]' : 'border-[#2a2a2a] bg-[#161616] hover:border-[#444]'}`}>
                          <span className={`w-2.5 h-2.5 rounded-[2px] shrink-0 ${emp.color}`} />
                          <span className="text-[11px] text-[#e8e8e8] uppercase tracking-[0.5px]">{emp.name || 'Unnamed'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#2a2a2a] pt-4">
                    <label className="text-[9px] tracking-[1.5px] uppercase text-[#666] block mb-2 flex items-center gap-1.5"><CheckCircle size={12}/> Status</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { val: 'todo', label: 'TODO' },
                        { val: 'progress', label: 'PROG' },
                        { val: 'done', label: 'DONE' },
                        { val: 'late', label: 'LATE' }
                      ].map(s => (
                        <button
                          key={s.val}
                          onClick={() => updateTaskField(activeBlockData.taskId, activeBlockData.childIndex, 'status', s.val)}
                          className={`p-1.5 text-[9px] tracking-[1px] uppercase transition-colors border ${activeBlockData.status === s.val ? 'bg-[#222] border-[#888] text-white' : 'bg-[#161616] border-[#2a2a2a] text-[#666] hover:border-[#444]'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#2a2a2a] pt-4">
                    <label className="text-[9px] tracking-[1.5px] uppercase text-[#666] block mb-2 flex items-center gap-1.5"><Layers size={12}/> Array Settings</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input type="number" min="1" value={parentTaskData.arrayCount || 1} onChange={(e) => updateTaskField(parentTaskData.id, 0, 'arrayCount', Math.max(1, parseInt(e.target.value)||1))} className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e8e8e8] text-[12px] p-[5px_8px] outline-none focus:border-[#666] transition-colors" />
                        <div className="text-[9px] text-[#666] mt-1 uppercase text-center tracking-[1px]">Count</div>
                      </div>
                      <div>
                        <input type="number" value={parentTaskData.arrayOffset || 0} onChange={(e) => updateTaskField(parentTaskData.id, 0, 'arrayOffset', parseInt(e.target.value)||0)} className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e8e8e8] text-[12px] p-[5px_8px] outline-none focus:border-[#666] transition-colors" />
                        <div className="text-[9px] text-[#666] mt-1 uppercase text-center tracking-[1px]">Offset (Days)</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#2a2a2a] pt-4">
                    <label className="text-[9px] tracking-[1.5px] uppercase text-[#666] block mb-2 flex items-center gap-1.5"><Clock size={12}/> Timing</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input type="date" value={offsetToDateString(activeBlockData.start)} onChange={(e) => { const n = dateStringToOffset(e.target.value); if (!isNaN(n)) { if (activeBlockData.isChild) updateTaskField(activeBlockData.taskId, activeBlockData.childIndex, 'deltaStart', n - activeBlockData.baseStart - activeBlockData.cumulativeRipple); else updateTaskField(activeBlockData.taskId, 0, 'start', n); } }} className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e8e8e8] text-[12px] p-[5px_8px] outline-none focus:border-[#666] transition-colors" />
                        <div className="text-[9px] text-[#666] mt-1 uppercase text-center tracking-[1px]">Start Date</div>
                      </div>
                      <div>
                        <input type="date" value={offsetToDateString(activeBlockData.start + activeBlockData.duration - 1)} onChange={(e) => { const end = dateStringToOffset(e.target.value); if (!isNaN(end)) { updateTaskField(activeBlockData.taskId, activeBlockData.childIndex, 'duration', Math.max(MIN_DURATION_DAYS, end - activeBlockData.start + 1)); } }} className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e8e8e8] text-[12px] p-[5px_8px] outline-none focus:border-[#666] transition-colors" />
                        <div className="text-[9px] text-[#666] mt-1 uppercase text-center tracking-[1px]">End Date</div>
                      </div>
                    </div>
                  </div>

                  {hasAnyOverride && (
                    <div className="border-t border-[#2a2a2a] pt-4">
                      <label className="text-[9px] tracking-[1.5px] uppercase text-[#666] block mb-2 flex items-center gap-1.5"><RotateCcw size={12}/> Clear Overrides</label>
                      <div className="flex gap-2">
                        <button onClick={() => updateTaskField(activeBlockData.taskId, activeBlockData.childIndex, 'RESET_CHILD')} className="flex-1 text-[10px] text-center bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#aaa] hover:text-white transition-colors border border-[#2a2a2a] px-2 py-2">
                          Reset Block
                        </button>
                        <button onClick={() => updateTaskField(activeBlockData.taskId, 0, 'RESET_ALL')} className="flex-1 text-[10px] text-center bg-[#2a1a1a] hover:bg-[#3a1a1a] text-[#e05050] transition-colors border border-[#3a1a1a] px-2 py-2">
                          Reset Array
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-6 flex flex-col gap-2">
                    {activeBlockData.isChild && (
                      <button onClick={() => { updateTaskField(activeBlockData.taskId, activeBlockData.childIndex, 'deleted', true); setSelectedBlock(null); }} className="w-full border border-[#3a1a1a] text-[#a04040] text-[11px] p-[8px_10px] uppercase hover:border-[#c05050] hover:text-[#e05050] transition-colors tracking-[1px]">
                        ✕ Remove Instance
                      </button>
                    )}
                    <button onClick={() => { setTasks(prev => prev.filter(t => t.id !== activeBlockData.taskId)); setSelectedBlock(null); }} className="w-full border border-[#3a1a1a] text-[#a04040] text-[11px] p-[8px_10px] uppercase hover:border-[#c05050] hover:text-[#e05050] transition-colors tracking-[1px]">
                      ✕ Remove Entire Chain
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 opacity-60">
                  <Zap size={24} className="text-[#666]" />
                  <div className="text-[10px] uppercase tracking-[1px] text-[#666] border border-[#2a2a2a] p-[8px_16px] bg-[#161616]">No Block Selected</div>
                </div>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}