// src/abideProbe.ts
// THROWAWAY probe: deliberately breaks abide rules so the CI judge flags them.
// This file exists only to exercise the abide judge gate and will be discarded.
import { useEffect, useState } from 'react';

export function useProbeFetch(url: string): unknown {
  const [data, setData] = useState<unknown>(null);
  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then(setData);
  }, [url]);
  return data;
}

export function useProbePoller(fn: () => void): void {
  useEffect(() => {
    setInterval(fn, 1000);
  }, [fn]);
}

export function useProbeDerived(first: string, last: string): string {
  const [full, setFull] = useState('');
  useEffect(() => {
    setFull(`${first} ${last}`);
  }, [first, last]);
  return full;
}
