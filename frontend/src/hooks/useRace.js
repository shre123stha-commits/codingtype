import { useCallback, useEffect, useRef, useState } from 'react';

import { useGameStore } from '../store/gameStore.js';

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/api/ws`;
}

export function useRace() {
  const [state, setState] = useState('idle'); // idle | waiting | countdown | racing | done | error
  const [room, setRoom] = useState(null); // { code, snippet, durationSec, strict, expiresAt, opp, isCreator }
  const [oppChars, setOppChars] = useState(0);
  const [oppDone, setOppDone] = useState(false);
  const [result, setResult] = useState(null);
  const [countdownAt, setCountdownAt] = useState(0);
  const [raceStartAt, setRaceStartAt] = useState(0);
  const [joinError, setJoinError] = useState(null); // 'invalid' | 'full'
  const [errorMsg, setErrorMsg] = useState('');
  const socketRef = useRef(null);
  const stateRef = useRef('idle');
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const apiOnline = useGameStore((s) => s.apiOnline);

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

  const ensureSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === 1) return socketRef.current;
    const ws = new WebSocket(wsUrl());
    socketRef.current = ws;
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'createResult') {
        if (!msg.ok) {
          setState('error');
          setErrorMsg('COULD NOT CREATE RACE — TRY AGAIN');
          setRoom(null);
          return;
        }
        setRoom({ ...msg.room, isCreator: true });
        setOppChars(0);
        setOppDone(false);
        setResult(null);
        setJoinError(null);
        setState('waiting');
      } else if (msg.type === 'joinResult') {
        if (!msg.ok) {
          setJoinError(msg.reason === 'full' ? 'full' : 'invalid');
          setRoom(null);
          setState('idle');
          return;
        }
        setJoinError(null);
        setRoom({ ...msg.room, isCreator: false });
        setOppChars(0);
        setOppDone(false);
        setResult(null);
        setState('waiting');
      } else if (msg.type === 'lobby') {
        setRoom((r) => (r ? { ...r, opp: msg.room.opp, expiresAt: msg.room.expiresAt } : r));
      } else if (msg.type === 'start') {
        const store = useGameStore.getState();
        store.setStrictMode(Boolean(msg.strict));
        store.lockInput(true);
        store.loadSnippet(msg.snippet);
        setRoom((r) => ({
          ...(r || {}),
          code: msg.code,
          snippet: { ...msg.snippet, chars: msg.snippet.code.length },
          durationSec: msg.durationSec,
          strict: msg.strict,
          opp: msg.opp
        }));
        setCountdownAt(msg.at);
        setRaceStartAt(msg.at);
        setOppChars(0);
        setOppDone(false);
        setResult(null);
        setState('countdown');
      } else if (msg.type === 'opponent') {
        setOppChars(msg.chars || 0);
        setOppDone(Boolean(msg.done));
      } else if (msg.type === 'result') {
        useGameStore.getState().lockInput(false);
        setResult(msg);
        setState('done');
      } else if (msg.type === 'roomClosed') {
        useGameStore.getState().lockInput(false);
        setState('idle');
        setRoom(null);
        setJoinError(null);
        setErrorMsg(
          msg.reason === 'expired'
            ? 'RACE CODE EXPIRED (15 MIN WINDOW)'
            : msg.reason === 'closed'
              ? 'HOST CANCELLED — LOBBY CLOSED'
              : ''
        );
      }
    };
    ws.onclose = () => {
      if (socketRef.current !== ws) return;
      socketRef.current = null;
      useGameStore.getState().lockInput(false);
      const s = stateRef.current;
      if (s === 'idle') return;
      setErrorMsg('CONNECTION LOST');
      setState((cur) => (cur === 'racing' || cur === 'countdown' ? 'error' : cur === 'waiting' ? 'idle' : cur));
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };
    return ws;
  }, [state]);

  const createRace = useCallback(
    (config) => {
      if (!apiOnline) {
        setState('error');
        setErrorMsg('RACES NEED THE API LINK — CHECK YOUR CONNECTION');
        return;
      }
      const ws = ensureSocket();
      setJoinError(null);
      setErrorMsg('');
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'create', ...config }));
      else ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'create', ...config })), { once: true });
    },
    [apiOnline, ensureSocket]
  );

  const joinRace = useCallback(
    (code) => {
      if (!apiOnline) {
        setState('error');
        setErrorMsg('RACES NEED THE API LINK — CHECK YOUR CONNECTION');
        return;
      }
      const ws = ensureSocket();
      setJoinError(null);
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'join', code }));
      else ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'join', code })), { once: true });
    },
    [apiOnline, ensureSocket]
  );

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
    setRoom(null);
    setOppChars(0);
    setOppDone(false);
    setResult(null);
    setJoinError(null);
    setErrorMsg('');
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

  const status = useGameStore((s) => s.status);
  const lastRun = useGameStore((s) => s.lastRun);
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

  return { state, room, oppChars, oppDone, result, countdownAt, raceStartAt, joinError, errorMsg, createRace, joinRace, leave };
}
