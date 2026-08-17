const states = new Map();

function setState(telegramId, state, data = {}) {
  states.set(String(telegramId), { state, data });
}

function getState(telegramId) {
  return states.get(String(telegramId)) || null;
}

function clearState(telegramId) {
  states.delete(String(telegramId));
}

module.exports = { setState, getState, clearState };
