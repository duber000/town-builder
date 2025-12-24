/**
 * Data Structures and Algorithms Utilities
 * Implements LRU Cache, Bloom Filter, and Circular Buffer
 */

// Security and configuration constants
const MAX_LRU_CACHE_SIZE = 1000; // Maximum cache size to prevent memory exhaustion
const MAX_BLOOM_FILTER_SIZE = 1000000; // Maximum bits for bloom filter
const MAX_BLOOM_FILTER_HASHES = 10; // Maximum hash functions
const MAX_CIRCULAR_BUFFER_CAPACITY = 10000; // Maximum buffer capacity
const MAX_BIT_VECTOR_SIZE = 1000000; // Maximum bits for bit vector

/**
 * LRU (Least Recently Used) Cache
 * Provides O(1) get and set operations with automatic eviction of least recently used items
 */
export class LRUCache {
    constructor(maxSize = 100) {
        // Security: Enforce maximum size
        if (maxSize > MAX_LRU_CACHE_SIZE) {
            throw new Error(`LRU cache size ${maxSize} exceeds maximum ${MAX_LRU_CACHE_SIZE}`);
        }
        if (maxSize < 1) {
            throw new Error('LRU cache size must be at least 1');
        }

        this.maxSize = maxSize;
        this.cache = new Map(); // Maintains insertion order in JS
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get value from cache. Returns undefined if not found.
     * Moves item to end (most recently used position)
     */
    get(key) {
        if (!this.cache.has(key)) {
            this.misses++;
            return undefined;
        }

        // Move to end by deleting and re-inserting
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        this.hits++;
        return value;
    }

    /**
     * Set value in cache. Evicts oldest item if at capacity.
     */
    set(key, value) {
        // If key exists, delete it first (will re-add at end)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Add to end (most recently used)
        this.cache.set(key, value);

        // Evict oldest if over capacity
        if (this.cache.size > this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Check if key exists in cache
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Remove specific key from cache
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * Clear all items from cache
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get current cache size
     */
    size() {
        return this.cache.size;
    }

    /**
     * Get cache hit rate (0-1)
     */
    getHitRate() {
        const total = this.hits + this.misses;
        return total === 0 ? 0 : this.hits / total;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.getHitRate()
        };
    }
}

/**
 * Bloom Filter
 * Space-efficient probabilistic data structure for set membership testing
 * False positives possible (says "maybe in set"), false negatives impossible
 */
export class BloomFilter {
    constructor(expectedItems = 1000, falsePositiveRate = 0.01) {
        // Security: Validate inputs
        if (expectedItems < 1 || expectedItems > MAX_BLOOM_FILTER_SIZE) {
            throw new Error(`Expected items ${expectedItems} out of valid range [1, ${MAX_BLOOM_FILTER_SIZE}]`);
        }
        if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
            throw new Error('False positive rate must be between 0 and 1');
        }

        // Calculate optimal bit array size and number of hash functions
        this.size = this._optimalSize(expectedItems, falsePositiveRate);
        this.numHashes = this._optimalHashCount(this.size, expectedItems);

        // Security: Enforce maximum hash functions
        if (this.numHashes > MAX_BLOOM_FILTER_HASHES) {
            this.numHashes = MAX_BLOOM_FILTER_HASHES;
        }

        // Security: Enforce maximum size
        if (this.size > MAX_BLOOM_FILTER_SIZE) {
            this.size = MAX_BLOOM_FILTER_SIZE;
        }

        // Use Uint8Array for bit storage (8 bits per byte)
        this.bits = new Uint8Array(Math.ceil(this.size / 8));
        this.itemCount = 0;
    }

    /**
     * Calculate optimal bit array size
     * m = -(n * ln(p)) / (ln(2)^2)
     */
    _optimalSize(n, p) {
        return Math.ceil(-(n * Math.log(p)) / (Math.log(2) ** 2));
    }

    /**
     * Calculate optimal number of hash functions
     * k = (m / n) * ln(2)
     */
    _optimalHashCount(m, n) {
        return Math.max(1, Math.round((m / n) * Math.log(2)));
    }

    /**
     * Generate hash values using double hashing technique
     * h_i(x) = h1(x) + i * h2(x)
     */
    _getHashes(item) {
        const str = String(item);
        const hash1 = this._hash(str, 0);
        const hash2 = this._hash(str, 1);
        const hashes = [];

        for (let i = 0; i < this.numHashes; i++) {
            const hash = (hash1 + i * hash2) % this.size;
            hashes.push(Math.abs(hash));
        }

        return hashes;
    }

    /**
     * Simple hash function (FNV-1a variant)
     */
    _hash(str, seed) {
        let hash = 2166136261 ^ seed;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return hash >>> 0; // Convert to unsigned 32-bit integer
    }

    /**
     * Set a bit in the bit array
     */
    _setBit(index) {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        this.bits[byteIndex] |= (1 << bitIndex);
    }

    /**
     * Get a bit from the bit array
     */
    _getBit(index) {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        return (this.bits[byteIndex] & (1 << bitIndex)) !== 0;
    }

    /**
     * Add item to bloom filter
     */
    add(item) {
        const hashes = this._getHashes(item);
        for (const hash of hashes) {
            this._setBit(hash);
        }
        this.itemCount++;
    }

    /**
     * Check if item might be in set
     * Returns true if possibly in set, false if definitely not in set
     */
    has(item) {
        const hashes = this._getHashes(item);
        for (const hash of hashes) {
            if (!this._getBit(hash)) {
                return false; // Definitely not in set
            }
        }
        return true; // Possibly in set
    }

    /**
     * Get current false positive probability
     */
    getFalsePositiveRate() {
        // p = (1 - e^(-kn/m))^k
        const k = this.numHashes;
        const n = this.itemCount;
        const m = this.size;
        return Math.pow(1 - Math.exp(-k * n / m), k);
    }

    /**
     * Clear all bits
     */
    clear() {
        this.bits.fill(0);
        this.itemCount = 0;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            size: this.size,
            numHashes: this.numHashes,
            itemCount: this.itemCount,
            estimatedFalsePositiveRate: this.getFalsePositiveRate(),
            memoryBytes: this.bits.length
        };
    }
}

/**
 * Circular Buffer (Ring Buffer)
 * Fixed-size buffer that overwrites oldest data when full
 * Efficient for sliding window operations
 */
export class CircularBuffer {
    constructor(capacity) {
        // Security: Validate capacity
        if (capacity < 1 || capacity > MAX_CIRCULAR_BUFFER_CAPACITY) {
            throw new Error(`Circular buffer capacity ${capacity} out of valid range [1, ${MAX_CIRCULAR_BUFFER_CAPACITY}]`);
        }

        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.head = 0; // Next write position
        this.size = 0; // Current number of elements
    }

    /**
     * Add item to buffer (overwrites oldest if full)
     */
    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;

        if (this.size < this.capacity) {
            this.size++;
        }
    }

    /**
     * Get item at index (0 = oldest, size-1 = newest)
     */
    get(index) {
        if (index < 0 || index >= this.size) {
            return undefined;
        }

        // Calculate actual position in circular buffer
        const actualIndex = (this.head - this.size + index + this.capacity) % this.capacity;
        return this.buffer[actualIndex];
    }

    /**
     * Get all items as array (oldest to newest)
     */
    toArray() {
        const result = [];
        for (let i = 0; i < this.size; i++) {
            result.push(this.get(i));
        }
        return result;
    }

    /**
     * Get newest item
     */
    getNewest() {
        return this.size > 0 ? this.get(this.size - 1) : undefined;
    }

    /**
     * Get oldest item
     */
    getOldest() {
        return this.size > 0 ? this.get(0) : undefined;
    }

    /**
     * Calculate average of numeric values in buffer
     */
    average() {
        if (this.size === 0) return 0;

        let sum = 0;
        for (let i = 0; i < this.size; i++) {
            sum += this.get(i);
        }
        return sum / this.size;
    }

    /**
     * Calculate sum of numeric values in buffer
     */
    sum() {
        let sum = 0;
        for (let i = 0; i < this.size; i++) {
            sum += this.get(i);
        }
        return sum;
    }

    /**
     * Find minimum value in buffer
     */
    min() {
        if (this.size === 0) return undefined;

        let min = this.get(0);
        for (let i = 1; i < this.size; i++) {
            const val = this.get(i);
            if (val < min) min = val;
        }
        return min;
    }

    /**
     * Find maximum value in buffer
     */
    max() {
        if (this.size === 0) return undefined;

        let max = this.get(0);
        for (let i = 1; i < this.size; i++) {
            const val = this.get(i);
            if (val > max) max = val;
        }
        return max;
    }

    /**
     * Clear buffer
     */
    clear() {
        this.head = 0;
        this.size = 0;
    }

    /**
     * Check if buffer is full
     */
    isFull() {
        return this.size === this.capacity;
    }

    /**
     * Check if buffer is empty
     */
    isEmpty() {
        return this.size === 0;
    }

    /**
     * Get current size
     */
    getSize() {
        return this.size;
    }

    /**
     * Get capacity
     */
    getCapacity() {
        return this.capacity;
    }
}

/**
 * Bit Vector
 * Space-efficient bit manipulation for boolean flags
 */
export class BitVector {
    constructor(size) {
        // Security: Validate size
        if (size < 1 || size > MAX_BIT_VECTOR_SIZE) {
            throw new Error(`Bit vector size ${size} out of valid range [1, ${MAX_BIT_VECTOR_SIZE}]`);
        }

        this.size = size;
        this.words = new Uint32Array(Math.ceil(size / 32));
    }

    /**
     * Set bit at index to 1
     */
    set(index) {
        if (index < 0 || index >= this.size) return;
        const wordIndex = Math.floor(index / 32);
        const bitIndex = index % 32;
        this.words[wordIndex] |= (1 << bitIndex);
    }

    /**
     * Set bit at index to 0
     */
    clear(index) {
        if (index < 0 || index >= this.size) return;
        const wordIndex = Math.floor(index / 32);
        const bitIndex = index % 32;
        this.words[wordIndex] &= ~(1 << bitIndex);
    }

    /**
     * Get bit at index
     */
    get(index) {
        if (index < 0 || index >= this.size) return false;
        const wordIndex = Math.floor(index / 32);
        const bitIndex = index % 32;
        return (this.words[wordIndex] & (1 << bitIndex)) !== 0;
    }

    /**
     * Toggle bit at index
     */
    toggle(index) {
        if (index < 0 || index >= this.size) return;
        const wordIndex = Math.floor(index / 32);
        const bitIndex = index % 32;
        this.words[wordIndex] ^= (1 << bitIndex);
    }

    /**
     * Set all bits to 0
     */
    clearAll() {
        this.words.fill(0);
    }

    /**
     * Set all bits to 1
     */
    setAll() {
        this.words.fill(0xFFFFFFFF);
    }

    /**
     * Count number of set bits (population count)
     */
    popCount() {
        let count = 0;
        for (let i = 0; i < this.words.length; i++) {
            count += this._popCount32(this.words[i]);
        }
        return count;
    }

    /**
     * Count set bits in 32-bit word (Brian Kernighan's algorithm)
     */
    _popCount32(n) {
        let count = 0;
        while (n) {
            n &= (n - 1); // Clear lowest set bit
            count++;
        }
        return count;
    }

    /**
     * Get memory usage in bytes
     */
    getMemoryBytes() {
        return this.words.length * 4;
    }
}
