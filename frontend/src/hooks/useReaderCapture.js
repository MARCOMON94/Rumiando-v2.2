import { useEffect, useRef } from 'react';

function defaultExtractCodes(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function defaultShouldIgnoreTarget(target) {
  const element = target?.closest?.(
    '[data-reader-manual="true"], [data-reader-ignore="true"], input, textarea, select, [contenteditable="true"]'
  );

  if (!element) return false;

  return element.getAttribute?.('data-reader-capture') !== 'true';
}

export default function useReaderCapture({
  active = true,
  delay = 160,
  extractCodes = defaultExtractCodes,
  onCodes,
  onEscape,
  shouldCaptureIgnoredPaste,
  shouldIgnoreTarget = defaultShouldIgnoreTarget,
  shouldPause
}) {
  const bufferRef = useRef('');
  const timerRef = useRef(null);
  const callbacksRef = useRef({
    extractCodes,
    onCodes,
    onEscape,
    shouldCaptureIgnoredPaste,
    shouldIgnoreTarget,
    shouldPause
  });

  useEffect(() => {
    callbacksRef.current = {
      extractCodes,
      onCodes,
      onEscape,
      shouldCaptureIgnoredPaste,
      shouldIgnoreTarget,
      shouldPause
    };
  }, [extractCodes, onCodes, onEscape, shouldCaptureIgnoredPaste, shouldIgnoreTarget, shouldPause]);

  useEffect(() => {
    if (!active) return undefined;

    function isPaused() {
      return Boolean(callbacksRef.current.shouldPause?.());
    }

    function stopReaderEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function resetBuffer() {
      bufferRef.current = '';
      window.clearTimeout(timerRef.current);
    }

    function emitCodes(raw) {
      const codes = callbacksRef.current.extractCodes(raw);
      if (codes.length) {
        callbacksRef.current.onCodes?.(codes);
      }
    }

    function flushBuffer() {
      const raw = bufferRef.current;
      resetBuffer();

      if (raw && !isPaused()) {
        emitCodes(raw);
      }
    }

    function handleCaptureKeyDown(event) {
      if (isPaused()) return;

      if (event.key === 'Escape' && callbacksRef.current.onEscape) {
        stopReaderEvent(event);
        callbacksRef.current.onEscape(event);
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (callbacksRef.current.shouldIgnoreTarget?.(event.target)) return;

      const isFinishKey = event.key === 'Enter' || event.key === 'Tab';
      const isCharacter = event.key.length === 1;
      const isBackspace = event.key === 'Backspace';

      if (!isFinishKey && !isCharacter && !isBackspace) return;

      stopReaderEvent(event);

      if (isFinishKey) {
        flushBuffer();
        return;
      }

      if (isBackspace) {
        bufferRef.current = bufferRef.current.slice(0, -1);
        return;
      }

      bufferRef.current += event.key;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flushBuffer, delay);
    }

    function handleCapturePaste(event) {
      if (isPaused()) return;

      const pasted = event.clipboardData?.getData('text');
      if (!pasted) return;

      if (
        callbacksRef.current.shouldIgnoreTarget?.(event.target)
        && !callbacksRef.current.shouldCaptureIgnoredPaste?.(pasted, event)
      ) {
        return;
      }

      stopReaderEvent(event);
      resetBuffer();
      emitCodes(pasted);
    }

    window.addEventListener('keydown', handleCaptureKeyDown, true);
    window.addEventListener('paste', handleCapturePaste, true);

    return () => {
      window.removeEventListener('keydown', handleCaptureKeyDown, true);
      window.removeEventListener('paste', handleCapturePaste, true);
      window.clearTimeout(timerRef.current);
    };
  }, [active, delay]);
}
