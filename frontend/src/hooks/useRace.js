import { useCallback, useEffect, useRef, useState } from 'react';

import { useGameStore } from '../store/gameStore.js';

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/api/ws`;
}

export function useRace() {
  const [state, setState] = useState('idle');
  const [oppChars, setOppChars] = useState(0);
  const [oppDone, setOppDone] = useState(false);
  const [result, setResult] = useState(null);
  const [countdownAt, setCountdownAt] = useState(0);
  const [snippet, setSnippet] = useState(null);
  const socketRef = useRef(null);
  const loadSnippet = useGameStore((s) => s.loadSnippet);
  const status = useGameStore((s) => s.status);
  const lastRun = useGameStore((s) => s.lastRun);

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        /* already closed */
      }
      socketRef.current = null;
    }
    useGameStore.getState().lockInput(false);
  }, []);

  const join = useCallback(() => {
    cleanup();
    setState('connecting');
    const ws = new WebSocket(wsUrl());
    socketRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join' }));
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'lobby') {
        setState(msg.state === 'waiting' ? 'waiting' : msg.state === 'full' ? 'full' : 'timeout');
      } else if (msg.type === 'start') {
        setSnippet(msg.snippet);
        setCountdownAt(msg.at);
        setOppChars(0);
        setOppDone(false);
        setResult(null);
        setState('countdown');
        useGameStore.getState().lockInput(true);
        loadSnippet(msg.snippet);
      } else if (msg.type === 'opponent') {
        setOppChars(msg.chars || 0);
        setOppDone(Boolean(msg.done));
      } else if (msg.type === 'result') {
        useGameStore.getState().lockInput(false);
        setResult(msg);
        setState('done');
      }
    };
    ws.onclose = () => {
      if (socketRef.current !== ws) return;
      socketRef.current = null;
      useGameStore.getState().lockInput(false);
      setState((s) => (s === 'racing' || s === 'countdown' ? 'error' : s === 'waiting' || s === 'connecting' ? 'idle' : s));
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };
  }, [cleanup, loadSnippet]);

  const leave = useCallback(() => {
    const ws = socketRef.current;
    if (ws) {
      try {
        ws.send(JSON.stringify({ type: 'leave' }));
      } catch {
        /* noop */
      }
    }
    cleanup();
    setOppChars(0);
    setOppDone(false);
    setResult(null);
    setState('idle');
  }, [cleanup]);

  useEffect(() => {
    if (state !== 'countdown' || !countdownAt) return;
    const id = setTimeout(() => {
      useGameStore.getState().lockInput(false);
      setState('racing');
    }, Math.max(0, countdownAt - Date.now()));
    return () => clearTimeout(id);
  }, [state, countdownAt]);

  useEffect(() => {
    if (state !== 'racing') return;
    const id = setInterval(() => {
      const ws = socketRef.current;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'progress', chars: useGameStore.getState().pointer }));
      }
    }, 250);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state !== 'racing' || status !== 'finished' || !lastRun) return;
    const ws = socketRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'finish', stats: lastRun.stats, chars: lastRun.stats.chars }));
    }
  }, [state, status, lastRun]);

  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup]
  );

  return { state, oppChars, oppDone, result, countdownAt, snippet, join, leave };
}
