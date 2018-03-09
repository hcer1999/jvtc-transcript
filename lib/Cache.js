module.exports = class {
    constructor(expires = 60 * 1000) {
        this._expires = expires;
        this._store = {};
    }

    set(key, value, ondelete = (value) => undefined) {
        // 重复设置一个key的值时，取消上次的过期时回调
        if (this._store[key] && this._store[key].expireTimer) {
            clearTimeout(this._store[key].expireTimer);
        }
        let expireTimer = setTimeout(() => this.delete(key), this._expires);   // 过期时调用delete方法删除记录
        this._store[key] = {value, ondelete, expireTimer};
        return this._store[key].value;
    }

    get(key) {
        return this._store[key] ? this._store[key].value : null;
    }

    // 重置key的有效期
    refresh(key) {
        if (!this._store[key]) return;
        clearTimeout(this._store[key].expireTimer);
        let expireTimer = setTimeout(() => this.delete(key), this._expires);
        this._store[key].expireTimer = expireTimer;
    }

    delete(key) {
        if (!this._store[key]) return;
        let {ondelete, value, expireTimer} = this._store[key];
        clearTimeout(expireTimer);  // 为了保证手动调用delete方法后过期时回调不被触发
        ondelete(value);
        delete this._store[key];
    }
}