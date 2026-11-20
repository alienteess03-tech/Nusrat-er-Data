const ARRAY_FIELDS = ['transactions', 'recurring', 'debts', 'emis', 'envelopes', 'accounts', 'bills'];
const OBJECT_FIELDS = ['budgets', 'settings'];

export function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mergeMap(baseValue, localValue, remoteValue) {
  const base = asObject(baseValue);
  const local = asObject(localValue);
  const remote = asObject(remoteValue);
  const merged = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);

  for (const key of keys) {
    const bHas = Object.prototype.hasOwnProperty.call(base, key);
    const lHas = Object.prototype.hasOwnProperty.call(local, key);
    const rHas = Object.prototype.hasOwnProperty.call(remote, key);
    const b = base[key], l = local[key], r = remote[key];
    const localChanged = bHas !== lHas || (bHas && stableJson(b) !== stableJson(l));
    const remoteChanged = bHas !== rHas || (bHas && stableJson(b) !== stableJson(r));

    if (!localChanged) {
      if (rHas) merged[key] = r;
    } else if (!remoteChanged || (lHas === rHas && (!lHas || stableJson(l) === stableJson(r)))) {
      if (lHas) merged[key] = l;
    } else if (!lHas && rHas) {
      // A stale local delete must not erase a record edited on another device.
      merged[key] = r;
    } else if (lHas && !rHas) {
      // A local edit must not be lost just because the remote copy was deleted from an old base.
      merged[key] = l;
    } else if (lHas) {
      // If both sides changed the exact same record/key, prefer the incoming save.
      merged[key] = l;
    }
  }
  return merged;
}

function toIdMap(value) {
  const result = {};
  (Array.isArray(value) ? value : []).forEach((item, index) => {
    if (item && item.id !== undefined && item.id !== null) result[String(item.id)] = item;
    else result[`__row_${index}`] = item;
  });
  return result;
}

function mergeArray(base, local, remote) {
  return Object.values(mergeMap(toIdMap(base), toIdMap(local), toIdMap(remote)));
}

export function normalizeCloudState(value) {
  const source = asObject(value);
  const settings = { ...asObject(source.settings) };
  delete settings.fbConfig;
  delete settings.familyRoomId;
  const result = {};
  for (const field of ARRAY_FIELDS) result[field] = Array.isArray(source[field]) ? source[field] : [];
  for (const field of OBJECT_FIELDS) result[field] = field === 'settings' ? settings : asObject(source[field]);
  return result;
}

export function mergeCloudStates(baseValue, localValue, remoteValue) {
  const base = normalizeCloudState(baseValue);
  const local = normalizeCloudState(localValue);
  const remote = normalizeCloudState(remoteValue);
  const result = {};
  for (const field of ARRAY_FIELDS) result[field] = mergeArray(base[field], local[field], remote[field]);
  for (const field of OBJECT_FIELDS) result[field] = mergeMap(base[field], local[field], remote[field]);
  return result;
}
