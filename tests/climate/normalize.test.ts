import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, DEFAULT_STATE, freeLand, maxHumidity, normalize } from '../../src/climate/state.ts';

test('humidity is not limited up to 30 °C', () => {
  assert.equal(maxHumidity(-15), 100);
  assert.equal(maxHumidity(30), 100);
});

test('in strong heat humidity is limited', () => {
  assert.equal(maxHumidity(41), 56);
  assert.equal(maxHumidity(45), 40);
});

test('more residents, less free land', () => {
  assert.equal(freeLand(10000), 95);
  assert.equal(freeLand(100000), 50);
  assert.equal(freeLand(1000000), 5);
  assert.ok(freeLand(800000) < 30, 'megacity has little land');
});

test('normalize caps humidity and derives land', () => {
  const s = normalize({ ...DEFAULT_STATE, temp: 45, humidity: 90, population: 1000000, land: 77 });
  assert.equal(s.humidity, 40);
  assert.equal(s.land, 5);
});

test('the store keeps the state normalized', () => {
  const store = createStore(DEFAULT_STATE);
  store.set({ temp: 44, humidity: 95 });
  assert.equal(store.get().humidity, maxHumidity(44));
  store.set({ population: 1000000 });
  assert.equal(store.get().land, 5);
});

test('default state is already normal', () => {
  assert.deepEqual(normalize(DEFAULT_STATE), DEFAULT_STATE);
});
