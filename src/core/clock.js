// Animation clock in seconds, shared by everything that wobbles, pulses or sways.
export let T = 0;

export function advanceClock(dt) {
  T += dt;
}
