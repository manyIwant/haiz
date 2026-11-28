export function paintingLoadState(stage: string | undefined, elapsedMs: number) {
  if (stage === 'ready') return 'ready';
  if (stage === 'failed') return 'failed';
  return elapsedMs >= 90000 ? 'timeout' : 'waiting';
}
