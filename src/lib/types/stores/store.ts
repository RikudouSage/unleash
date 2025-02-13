export interface Store<T, K> {
    get(key: K): Promise<T>;
    getAll(): Promise<T[]>;
    exists(key: K): Promise<boolean>;
    delete(key: K): Promise<void>;
    deleteAll(): Promise<void>;
    destroy(): void;
}
