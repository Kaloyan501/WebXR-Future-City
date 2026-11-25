import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, DEFAULT_STATE, type CityState } from '../../src/climate/state.ts';

test('set merges', () => {
  const store = createStore(DEFAULT_STATE);
  store.set({ temp: 30 });
  assert.equal(store.get().temp, 30);
  assert.equal(store.get().humidity, DEFAULT_STATE.humidity);
});

test('subscribe fires immediately and on change', () => {
  const store = createStore(DEFAULT_STATE);
  const seen: CityState[] = [];
  store.subscribe((s) => seen.push(s));
  assert.equal(seen.length, 1);
  store.set({ temp: 30 });
  assert.equal(seen.length, 2);
  assert.equal(seen[1].temp, 30);
});

test('no notify when unchanged', () => {
  const store = createStore(DEFAULT_STATE);
  let calls = 0;
  store.subscribe(() => calls++);
  store.set({ temp: 18 });
  assert.equal(calls, 1);
});

test('unsubscribe stops calls', () => {
  const store = createStore(DEFAULT_STATE);
  let calls = 0;
  const off = store.subscribe(() => calls++);
  off();
  store.set({ temp: 30 });
  assert.equal(calls, 1);
});

test('default state matches the spec', () => {
  assert.deepEqual(DEFAULT_STATE, {
    temp: 18, humidity: 55, windSpeed: 15, windDir: 'З', aqi: 40, uv: 5,
    water: 60, land: 50, energy: 60, population: 100000, chosenMenu: null, scenarioId: 'temperate',
  });
});
