import { useEffect, useRef, useState } from "react";

export function useScanQueue({
  onScanAsync,
  timeoutMs = 80,
  dedupeMs = 1200,
  lockWhileProcessing = true,
  validate = null,
} = {}) {
  const bufferRef = useRef("");
  const timerRef = useRef(null);

  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const lastScanRef = useRef({ code: "", ts: 0 });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    function resetBufferSoon() {
      clearTimer();
      timerRef.current = setTimeout(() => { bufferRef.current = ""; }, timeoutMs);
    }
    async function processQueue() {
      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);
      try {
        while (queueRef.current.length > 0) {
          const code = queueRef.current.shift();
          await onScanAsync(code);
        }
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    }
    function enqueue(code) {
      queueRef.current.push(code);
      processQueue();
    }
    function handler(e) {
      if (lockWhileProcessing && processingRef.current) return;

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        clearTimer();
        if (!code) return;
        if (validate && !validate(code)) return;

        const now = Date.now();
        if (lastScanRef.current.code === code && now - lastScanRef.current.ts < dedupeMs) return;
        lastScanRef.current = { code, ts: now };

        enqueue(code);
        return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        resetBufferSoon();
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearTimer();
    };
  }, [onScanAsync, timeoutMs, dedupeMs, lockWhileProcessing, validate]);

  return { isProcessing };
}
