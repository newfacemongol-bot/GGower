let active = false;

export function setStressTestMode(on: boolean) {
  active = on;
}

export function isStressTestMode(): boolean {
  return active;
}
