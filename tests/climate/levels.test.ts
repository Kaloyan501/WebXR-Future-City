import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, type CityState } from '../../src/climate/state.ts';
import { levelsOf, formatSetting } from '../../src/climate/levels.ts';

const at = (patch: Partial<CityState>) => levelsOf({ ...DEFAULT_STATE, ...patch });

test('level boundaries follow the spec table', () => {
  const cases: [Partial<CityState>, keyof ReturnType<typeof levelsOf>, string][] = [
    [{ temp: 4.9 }, 'temp', 'Студено'],
    [{ temp: 5 }, 'temp', 'Умерено'],
    [{ temp: 25 }, 'temp', 'Умерено'],
    [{ temp: 26 }, 'temp', 'Топло'],
    [{ temp: 32 }, 'temp', 'Топло'],
    [{ temp: 33 }, 'temp', 'Жега'],
    [{ humidity: 29 }, 'humidity', 'Сухо'],
    [{ humidity: 30 }, 'humidity', 'Нормално'],
    [{ humidity: 70 }, 'humidity', 'Нормално'],
    [{ humidity: 71 }, 'humidity', 'Влажно'],
    [{ windSpeed: 9 }, 'wind', 'Тихо'],
    [{ windSpeed: 10 }, 'wind', 'Умерено'],
    [{ windSpeed: 40 }, 'wind', 'Умерено'],
    [{ windSpeed: 41 }, 'wind', 'Буря'],
    [{ aqi: 49 }, 'aqi', 'Добро'],
    [{ aqi: 50 }, 'aqi', 'Средно'],
    [{ aqi: 150 }, 'aqi', 'Средно'],
    [{ aqi: 151 }, 'aqi', 'Лошо'],
    [{ uv: 2 }, 'uv', 'Нисък'],
    [{ uv: 3 }, 'uv', 'Среден'],
    [{ uv: 7 }, 'uv', 'Среден'],
    [{ uv: 8 }, 'uv', 'Висок'],
    [{ water: 29 }, 'water', 'Дефицит'],
    [{ water: 30 }, 'water', 'Норма'],
    [{ water: 70 }, 'water', 'Норма'],
    [{ water: 71 }, 'water', 'Изобилие'],
    [{ land: 29 }, 'land', 'Малко'],
    [{ land: 30 }, 'land', 'Норма'],
    [{ land: 70 }, 'land', 'Норма'],
    [{ land: 71 }, 'land', 'Много'],
    [{ energy: 29 }, 'energy', 'Оскъдна'],
    [{ energy: 30 }, 'energy', 'Норма'],
    [{ energy: 70 }, 'energy', 'Норма'],
    [{ energy: 71 }, 'energy', 'Изобилна'],
  ];
  for (const [patch, key, expected] of cases) {
    assert.equal(at(patch)[key], expected, `${JSON.stringify(patch)} → ${key}`);
  }
});

const fmt = (key: Parameters<typeof formatSetting>[0], patch: Partial<CityState> = {}) =>
  formatSetting(key, { ...DEFAULT_STATE, ...patch });

test('format temp', () => assert.equal(fmt('temp', { temp: 41 }), '41 °C · Жега'));
test('format humidity', () => assert.equal(fmt('humidity'), '55 % · Нормално'));
test('format windSpeed', () => assert.equal(fmt('windSpeed'), '15 km/h · Умерено'));
test('format windDir', () => assert.equal(fmt('windDir'), 'З'));
test('format windDir null', () => assert.equal(fmt('windDir', { windDir: null }), 'Без посока'));
test('format aqi', () => assert.equal(fmt('aqi'), '40 · Добро'));
test('format uv', () => assert.equal(fmt('uv'), '5 · Среден'));
test('format water', () => assert.equal(fmt('water'), '60 % · Норма'));
test('format land', () => assert.equal(fmt('land'), '50 % · Норма'));
test('format energy', () => assert.equal(fmt('energy'), '60 % · Норма'));
test('format population', () => assert.equal(fmt('population'), '100 000 жители'));
test('format population million', () => assert.equal(fmt('population', { population: 1000000 }), '1 000 000 жители'));
test('format negative temp uses a real minus', () => assert.equal(fmt('temp', { temp: -5 }), '−5 °C · Студено'));

test('warning levels are the adverse ones only', async () => {
  const { isWarning } = await import('../../src/climate/levels.ts');
  assert.equal(isWarning('temp', at({ temp: 41 })), true);
  assert.equal(isWarning('temp', at({ temp: 18 })), false);
  assert.equal(isWarning('temp', at({ temp: -5 })), false);
  assert.equal(isWarning('wind', at({ windSpeed: 45 })), true);
  assert.equal(isWarning('aqi', at({ aqi: 240 })), true);
  assert.equal(isWarning('aqi', at({ aqi: 120 })), false);
  assert.equal(isWarning('uv', at({ uv: 10 })), true);
  assert.equal(isWarning('water', at({ water: 20 })), true);
  assert.equal(isWarning('land', at({ land: 10 })), false);
  assert.equal(isWarning('energy', at({ energy: 20 })), true);
  assert.equal(isWarning('humidity', at({ humidity: 90 })), false);
});
