module.exports = class {
  constructor(expires = 60 * 1000) {
    this._expires = expires;
    this._store = {};
  }

  set(key, value) {
    setTimeout(() => delete this._store[key], this._expires);
    return this._store[key] = value;
  }

  get(key) {
    return this._store[key];
  }

  delete(key) {
    delete this._store[key];
  }
}