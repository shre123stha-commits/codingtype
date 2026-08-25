export const LANGUAGES = ['python', 'c++', 'java', 'javascript', 'rust', 'sql'];

export const MODES = ['algorithm', 'repo', 'sprint', 'interview'];

export const SNIPPETS = [
  {
    id: 'py-alg-01',
    language: 'python',
    mode: 'algorithm',
    title: 'Binary Search',
    source: 'algorithms/binary_search.py',
    code: `def binary_search(items, target):
    low, high = 0, len(items) - 1
    while low <= high:
        mid = (low + high) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1`
  },
  {
    id: 'py-alg-02',
    language: 'python',
    mode: 'algorithm',
    title: 'BFS Level Order',
    source: 'algorithms/tree_bfs.py',
    code: `from collections import deque


def level_order(root):
    if root is None:
        return []
    queue = deque([root])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node.val)
        if node.left:
            queue.append(node.left)
        if node.right:
            queue.append(node.right)
    return order`
  },
  {
    id: 'py-repo-01',
    language: 'python',
    mode: 'repo',
    title: 'Order Processor Service',
    source: 'service/order_processor.py',
    code: `import json
import logging

from billing import charge_payment
from events import emit_event

logger = logging.getLogger("orders")


class OrderProcessor:
    def __init__(self, repository):
        self.repository = repository

    def process(self, order_id):
        order = self.repository.get(order_id)
        if order is None:
            raise ValueError(f"order {order_id} not found")
        receipt = charge_payment(order.total, order.currency)
        order.status = "paid"
        self.repository.save(order)
        emit_event("order.paid", {"id": order.id})
        logger.info("processed %s", order_id)
        return json.loads(order.to_json())`
  },
  {
    id: 'py-repo-02',
    language: 'python',
    mode: 'repo',
    title: 'Auth Middleware',
    source: 'api/middleware.py',
    code: `import time
from functools import wraps

from auth import resolve_token


def require_auth(fn):
    @wraps(fn)
    def wrapper(request, *args, **kwargs):
        token = request.headers.get("Authorization", "")
        if not token.startswith("Bearer "):
            request.abort(401)
        user = resolve_token(token.removeprefix("Bearer "))
        if user is None or user.suspended:
            request.abort(403)
        request.user = user
        started = time.perf_counter()
        response = fn(request, *args, **kwargs)
        request.log(f"auth {user.id} {time.perf_counter() - started:.3f}s")
        return response
    return wrapper`
  },
  {
    id: 'cpp-alg-01',
    language: 'c++',
    mode: 'algorithm',
    title: 'Quick Sort (Vector)',
    source: 'algorithms/quick_sort.cpp',
    code: `#include <algorithm>
#include <vector>

std::vector<int> quick_sort(std::vector<int> v) {
    if (v.size() <= 1) return v;
    int pivot = v[v.size() / 2];
    std::vector<int> less, equal, greater;
    for (int x : v) {
        if (x < pivot) less.push_back(x);
        else if (x > pivot) greater.push_back(x);
        else equal.push_back(x);
    }
    auto left = quick_sort(less);
    auto right = quick_sort(greater);
    left.insert(left.end(), equal.begin(), equal.end());
    left.insert(left.end(), right.begin(), right.end());
    return left;
}`
  },
  {
    id: 'cpp-alg-02',
    language: 'c++',
    mode: 'algorithm',
    title: 'Dijkstra Shortest Path',
    source: 'algorithms/dijkstra.cpp',
    code: `#include <climits>
#include <queue>
#include <utility>
#include <vector>

std::vector<int> dijkstra(const std::vector<std::vector<std::pair<int, int>>>& g, int src) {
    std::vector<int> dist(g.size(), INT_MAX);
    std::priority_queue<std::pair<int, int>,
        std::vector<std::pair<int, int>>, std::greater<>> pq;
    dist[src] = 0;
    pq.push({0, src});
    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();
        if (d > dist[u]) continue;
        for (const auto& [v, w] : g[u]) {
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }
    return dist;
}`
  },
  {
    id: 'cpp-repo-01',
    language: 'c++',
    mode: 'repo',
    title: 'ECS World Spawn/Destroy',
    source: 'engine/ecs/world.cpp',
    code: `#include <unordered_map>
#include <vector>

#include "ecs/archetype.hpp"

namespace engine {

World::World() : next_entity_id_(0) {}

Entity World::spawn(const Transform& transform) {
    Entity id{next_entity_id_++};
    auto& archetype = archetypes_.get<Transform>();
    archetype.insert(id, transform);
    entities_[id] = &archetype;
    return id;
}

void World::destroy(Entity id) {
    if (!entities_.contains(id)) return;
    auto* archetype = entities_[id];
    archetype->erase(id);
    entities_.erase(id);
}

}  // namespace engine`
  },
  {
    id: 'cpp-repo-02',
    language: 'c++',
    mode: 'repo',
    title: 'Socket Pool',
    source: 'net/socket_pool.cpp',
    code: `#include <mutex>
#include <optional>
#include <utility>
#include <vector>

#include "net/socket_pool.hpp"

namespace net {

std::optional<Socket> SocketPool::acquire() {
    std::lock_guard lock(mutex_);
    if (free_list_.empty()) {
        if (active_count_ >= capacity_) return std::nullopt;
        active_count_++;
        return Socket::open(endpoint_);
    }
    Socket socket = std::move(free_list_.back());
    free_list_.pop_back();
    return socket;
}

void SocketPool::release(Socket socket) {
    std::lock_guard lock(mutex_);
    if (!socket.valid()) {
        active_count_--;
        return;
    }
    free_list_.push_back(std::move(socket));
}

}  // namespace net`
  },
  {
    id: 'java-alg-01',
    language: 'java',
    mode: 'algorithm',
    title: 'Topological Sort (Kahn)',
    source: 'algorithms/TopologicalSort.java',
    code: `import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

public class TopologicalSort {
    public static List<Integer> sort(int[][] edges, int n) {
        int[] indeg = new int[n];
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        List<Integer> order = new ArrayList<>();
        for (int[] e : edges) indeg[e[1]]++;
        for (int i = 0; i < n; i++) {
            if (indeg[i] == 0) queue.add(i);
        }
        while (!queue.isEmpty()) {
            int node = queue.poll();
            order.add(node);
            for (int[] e : edges) {
                if (e[0] == node && --indeg[e[1]] == 0) queue.add(e[1]);
            }
        }
        return order;
    }
}`
  },
  {
    id: 'java-alg-02',
    language: 'java',
    mode: 'algorithm',
    title: 'Union-Find (Path Compression)',
    source: 'algorithms/UnionFind.java',
    code: `public class UnionFind {
    private final int[] parent;
    private final int[] rank;
    private int components;

    public UnionFind(int n) {
        parent = new int[n];
        rank = new int[n];
        components = n;
        for (int i = 0; i < n; i++) parent[i] = i;
    }

    public int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    public boolean union(int a, int b) {
        int ra = find(a);
        int rb = find(b);
        if (ra == rb) return false;
        if (rank[ra] < rank[rb]) {
            int t = ra;
            ra = rb;
            rb = t;
        }
        parent[rb] = ra;
        if (rank[ra] == rank[rb]) rank[ra]++;
        components--;
        return true;
    }
}`
  },
  {
    id: 'java-repo-01',
    language: 'java',
    mode: 'repo',
    title: 'Spring Order Controller',
    source: 'com/acme/api/OrderController.java',
    code: `package com.acme.api;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/orders")
public class OrderController {

    private final OrderService orders;

    public OrderController(OrderService orders) {
        this.orders = orders;
    }

    @GetMapping("/{id}")
    public OrderDto getOrder(@PathVariable Long id) {
        return orders.findById(id).orElseThrow();
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody CreateOrderRequest body) {
        OrderDto created = orders.create(body);
        return Map.of("id", created.id(), "state", created.state());
    }
}`
  },
  {
    id: 'java-repo-02',
    language: 'java',
    mode: 'repo',
    title: 'TTL Cache',
    source: 'com/acme/cache/TtlCache.java',
    code: `package com.acme.cache;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class TtlCache<K, V> {

    private record Entry<V>(V value, long expiresAt) {}

    private final Map<K, Entry<V>> store = new HashMap<>();
    private final Duration ttl;

    public TtlCache(Duration ttl) {
        this.ttl = ttl;
    }

    public Optional<V> get(K key) {
        Entry<V> entry = store.get(key);
        if (entry == null) return Optional.empty();
        if (System.currentTimeMillis() > entry.expiresAt()) {
            store.remove(key);
            return Optional.empty();
        }
        return Optional.of(entry.value());
    }

    public void put(K key, V value) {
        long expiresAt = System.currentTimeMillis() + ttl.toMillis();
        store.put(key, new Entry<>(value, expiresAt));
    }
}`
  },
  {
    id: 'js-alg-01',
    language: 'javascript',
    mode: 'algorithm',
    title: 'Quick Sort (Spread)',
    source: 'algorithms/quickSort.js',
    code: `function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = [];
  const mid = [];
  const right = [];
  for (const value of arr) {
    if (value < pivot) left.push(value);
    else if (value > pivot) right.push(value);
    else mid.push(value);
  }
  return [...quickSort(left), ...mid, ...quickSort(right)];
}

export { quickSort };`
  },
  {
    id: 'js-alg-02',
    language: 'javascript',
    mode: 'algorithm',
    title: 'Binary Search (Iterative)',
    source: 'algorithms/binarySearch.js',
    code: `function binarySearch(items, target) {
  let low = 0;
  let high = items.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (items[mid] === target) return mid;
    if (items[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

export { binarySearch };`
  },
  {
    id: 'js-repo-01',
    language: 'javascript',
    mode: 'repo',
    title: 'Express Orders Router',
    source: 'src/server/api/orders.js',
    code: `import { Router } from 'express';
import { validateOrder } from './validate.js';
import { ordersDao } from '../db/ordersDao.js';
import { emitOrderEvent } from '../events/bus.js';

const router = Router();

router.post('/orders', async (req, res) => {
  const error = validateOrder(req.body);
  if (error) return res.status(422).json({ error });
  const order = await ordersDao.create(req.body);
  emitOrderEvent('order.created', { id: order.id });
  res.status(201).json({ id: order.id, state: order.state });
});

router.get('/orders/:id', async (req, res) => {
  const order = await ordersDao.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  res.json(order);
});

export default router;`
  },
  {
    id: 'js-repo-02',
    language: 'javascript',
    mode: 'repo',
    title: 'Resilient Channel Client',
    source: 'src/realtime/channel.js',
    code: `export function createChannel(url, { onOpen, onMessage, onError }) {
  let socket = null;
  let queue = [];
  let retries = 0;

  const connect = () => {
    socket = new WebSocket(url);
    socket.onopen = () => {
      retries = 0;
      onOpen?.();
      queue.forEach((frame) => socket.send(frame));
      queue = [];
    };
    socket.onmessage = (event) => onMessage(JSON.parse(event.data));
    socket.onclose = () => {
      retries += 1;
      setTimeout(connect, Math.min(1000 * 2 ** retries, 30000));
    };
  };

  return {
    send(payload) {
      const frame = JSON.stringify(payload);
      if (socket?.readyState === WebSocket.OPEN) socket.send(frame);
      else queue.push(frame);
    },
    close() {
      socket?.close();
      onError?.(new Error('channel closed'));
    },
  };
}`
  },
  {
    id: 'rs-alg-01',
    language: 'rust',
    mode: 'algorithm',
    title: 'Binary Search (Ordering)',
    source: 'algorithms/binary_search.rs',
    code: `use std::cmp::Ordering;

pub fn binary_search(items: &[i64], target: i64) -> Option<usize> {
    let (mut low, mut high) = (0, items.len());
    while low < high {
        let mid = low + (high - low) / 2;
        match items[mid].cmp(&target) {
            Ordering::Equal => return Some(mid),
            Ordering::Less => low = mid + 1,
            Ordering::Greater => high = mid,
        }
    }
    None
}`
  },
  {
    id: 'rs-alg-02',
    language: 'rust',
    mode: 'algorithm',
    title: 'In-Place Quick Sort',
    source: 'algorithms/quick_sort.rs',
    code: `pub fn quick_sort(items: &mut [i64]) {
    if items.len() <= 1 {
        return;
    }
    let pivot = items[items.len() - 1];
    let mut i = 0;
    for j in 0..items.len() - 1 {
        if items[j] <= pivot {
            items.swap(i, j);
            i += 1;
        }
    }
    items.swap(i, items.len() - 1);
    quick_sort(&mut items[..i]);
    quick_sort(&mut items[i + 1..]);
}`
  },
  {
    id: 'rs-repo-01',
    language: 'rust',
    mode: 'repo',
    title: 'Axum Order Handlers',
    source: 'src/handlers/orders.rs',
    code: `use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::models::CreateOrder;
use crate::state::AppState;

pub async fn create_order(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateOrder>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, String)> {
    let order = state
        .orders
        .create(payload)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok((StatusCode::CREATED, Json(order.into_json())))
}

pub async fn get_order(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .orders
        .get(id)
        .await
        .map(Json::from)
        .ok_or(StatusCode::NOT_FOUND)
}`
  },
  {
    id: 'rs-repo-02',
    language: 'rust',
    mode: 'repo',
    title: 'Fixed-Step Engine Loop',
    source: 'src/engine/loop.rs',
    code: `pub fn run(mut ctx: Context) -> Result<(), EngineError> {
    let mut frame = Frame::new(ctx.clock.now());
    while !ctx.should_exit() {
        ctx.input.poll(&mut frame.events);
        frame.events.drain();
        ctx.systems.update(&mut frame);
        ctx.renderer.draw(&frame);
        frame = Frame::next(ctx.clock.now());
    }
    Ok(())
}

impl Frame {
    pub fn new(now: Instant) -> Self {
        Self { now, events: Vec::new() }
    }

    pub fn next(now: Instant) -> Self {
        Self { now, events: Vec::new() }
    }
}`
  },
  {
    id: 'sql-alg-01',
    language: 'sql',
    mode: 'algorithm',
    title: 'Running Total (Window)',
    source: 'analytics/running_total.sql',
    code: `WITH ordered AS (
    SELECT
        id,
        amount,
        SUM(amount) OVER (
            ORDER BY created_at
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_total
    FROM transactions
)
SELECT id, amount, running_total
FROM ordered
WHERE running_total <= 1000
ORDER BY id;`
  },
  {
    id: 'sql-alg-02',
    language: 'sql',
    mode: 'algorithm',
    title: 'Gap-and-Island Detection',
    source: 'analytics/islands.sql',
    code: `WITH marked AS (
    SELECT
        id,
        started_at,
        started_at
            - (ROW_NUMBER() OVER (ORDER BY started_at))
                * INTERVAL '1 second' AS grp
    FROM sessions
    WHERE duration_sec > 30
)
SELECT
    MIN(started_at) AS island_start,
    COUNT(*) AS event_count
FROM marked
GROUP BY grp
ORDER BY island_start;`
  },
  {
    id: 'sql-repo-01',
    language: 'sql',
    mode: 'repo',
    title: 'Production Migration',
    source: 'migrations/004_add_indexes.sql',
    code: `BEGIN;

CREATE INDEX CONCURRENTLY idx_orders_tenant_created
    ON orders (tenant_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_orders_status_due
    ON orders (status, due_at)
    WHERE status IN ('pending', 'due');

CREATE INDEX CONCURRENTLY idx_events_user_at
    ON events (user_id, event_at DESC);

COMMENT ON INDEX idx_orders_tenant_created
    IS 'covers tenant dashboard list queries';

COMMIT;`
  },
  {
    id: 'sql-repo-02',
    language: 'sql',
    mode: 'repo',
    title: 'Retention Cohorts',
    source: 'analytics/retention_cohorts.sql',
    code: `WITH first_touch AS (
    SELECT
        user_id,
        DATE_TRUNC('month', first_seen_at) AS cohort
    FROM users
    GROUP BY 1, 2
),
activity AS (
    SELECT
        user_id,
        DATE_TRUNC('month', event_at) AS month
    FROM events
    GROUP BY 1, 2
)
SELECT
    f.cohort,
    DATE_TRUNC('month', a.month) - DATE_TRUNC('month', f.cohort)
        AS months_since,
    COUNT(DISTINCT f.user_id) AS cohort_size,
    COUNT(DISTINCT a.user_id)::float
        / COUNT(DISTINCT f.user_id) AS retention
FROM first_touch f
LEFT JOIN activity a ON f.user_id = a.user_id
    GROUP BY f.cohort, 2
ORDER BY f.cohort, months_since;`
  },
  {
    id: 'py-drill-01',
    language: 'python',
    mode: 'sprint',
    title: 'Map & Unpack Sprint',
    source: 'drills/sprint_01.py',
    code: `m = {k: v for k, v in pairs}
k, *r = seq[1:]
print(m[k] and r)`
  },
  {
    id: 'py-drill-02',
    language: 'python',
    mode: 'sprint',
    title: 'Typed List Sprint',
    source: 'drills/sprint_02.py',
    code: `a: list[int] = [0] * n
b = [x ** 2 for x in a]
c = max(a) // min(b)`
  },
  {
    id: 'py-drill-03',
    language: 'python',
    mode: 'sprint',
    title: 'Swap & Merge Sprint',
    source: 'drills/sprint_03.py',
    code: `if a < b:
    a, b = b, a
while q:
    q.popleft()
d = {**x, **y}`
  },
  {
    id: 'cpp-drill-01',
    language: 'c++',
    mode: 'sprint',
    title: 'Lambda Sprint',
    source: 'drills/sprint_01.cpp',
    code: `int a[10] = {0};
auto f = [](int x) { return x * 2; };`
  },
  {
    id: 'cpp-drill-02',
    language: 'c++',
    mode: 'sprint',
    title: 'Map Pair Sprint',
    source: 'drills/sprint_02.cpp',
    code: `std::map<int, int> m{{1, 2}};
for (auto& [k, v] : m) v += k;`
  },
  {
    id: 'cpp-drill-03',
    language: 'c++',
    mode: 'sprint',
    title: 'Ternary Sprint',
    source: 'drills/sprint_03.cpp',
    code: `void f(int a) { g(a > 0 ? a : -a); }
const int* p = nullptr;`
  },
  {
    id: 'java-drill-01',
    language: 'java',
    mode: 'sprint',
    title: 'HashMap Sprint',
    source: 'drills/sprint_01.java',
    code: `Map<Integer, Integer> m = new HashMap<>();
m.put(1, 2);
m.put(2, 3);`
  },
  {
    id: 'java-drill-02',
    language: 'java',
    mode: 'sprint',
    title: 'Stream Sprint',
    source: 'drills/sprint_02.java',
    code: `int[] a = {1, 2, 3};
int s = Arrays.stream(a).sum();`
  },
  {
    id: 'java-drill-03',
    language: 'java',
    mode: 'sprint',
    title: 'Modifier Sprint',
    source: 'drills/sprint_03.java',
    code: `private final int x = 0;
public int get() { return x; }`
  },
  {
    id: 'js-drill-01',
    language: 'javascript',
    mode: 'sprint',
    title: 'Destructure Sprint',
    source: 'drills/sprint_01.js',
    code: `const m = new Map([["a", 1]]);
const { x, ...rest } = obj;`
  },
  {
    id: 'js-drill-02',
    language: 'javascript',
    mode: 'sprint',
    title: 'Arrow Sprint',
    source: 'drills/sprint_02.js',
    code: `const f = (a, b) => a > b ? a - b : b - a;
const r = [1, 2, 3].map((n) => n * 2);`
  },
  {
    id: 'js-drill-03',
    language: 'javascript',
    mode: 'sprint',
    title: 'Guard Sprint',
    source: 'drills/sprint_03.js',
    code: `if (a && b !== null) c[d] = e;
try { await f(); } catch (err) { log(err); }`
  },
  {
    id: 'rs-drill-01',
    language: 'rust',
    mode: 'sprint',
    title: 'HashMap Sprint',
    source: 'drills/sprint_01.rs',
    code: `let m: HashMap<i64, i64> = HashMap::new();
m.insert(1, 2);`
  },
  {
    id: 'rs-drill-02',
    language: 'rust',
    mode: 'sprint',
    title: 'Range Collect Sprint',
    source: 'drills/sprint_02.rs',
    code: `let v: Vec<i32> = (0..10).collect();
let s: i32 = v.iter().sum();`
  },
  {
    id: 'rs-drill-03',
    language: 'rust',
    mode: 'sprint',
    title: 'Match Sprint',
    source: 'drills/sprint_03.rs',
    code: `match x {
    0 => None,
    _ => Some(x),
}`
  },
  {
    id: 'sql-drill-01',
    language: 'sql',
    mode: 'sprint',
    title: 'Aggregate Sprint',
    source: 'drills/sprint_01.sql',
    code: `SELECT id, COUNT(*) AS n
FROM t
GROUP BY id
HAVING n > 3;`
  },
  {
    id: 'sql-drill-02',
    language: 'sql',
    mode: 'sprint',
    title: 'DML Sprint',
    source: 'drills/sprint_02.sql',
    code: `UPDATE t SET a = a + 1 WHERE id IN (1, 2);
DELETE FROM t WHERE x < 0 OR y > 9;`
  },
  {
    id: 'sql-drill-03',
    language: 'sql',
    mode: 'sprint',
    title: 'Join Sprint',
    source: 'drills/sprint_03.sql',
    code: `SELECT a.x, b.y
FROM a JOIN b ON a.id = b.a_id
WHERE b.z IS NOT NULL;`
  },
  {
    id: 'py-int-01',
    language: 'python',
    mode: 'interview',
    title: 'Two Sum',
    source: 'interview/two_sum.py',
    code: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        need = target - num
        if need in seen:
            return [seen[need], i]
        seen[num] = i
    return []`
  },
  {
    id: 'py-int-02',
    language: 'python',
    mode: 'interview',
    title: 'Max Subarray',
    source: 'interview/max_subarray.py',
    code: `def max_subarray(nums):
    best = nums[0]
    cur = nums[0]
    for x in nums[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best`
  },
  {
    id: 'py-int-03',
    language: 'python',
    mode: 'interview',
    title: 'Valid Parentheses',
    source: 'interview/valid_parens.py',
    code: `def is_valid(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in pairs.values():
            stack.append(ch)
        elif not stack or stack.pop() != pairs[ch]:
            return False
    return not stack`
  },
  {
    id: 'js-int-01',
    language: 'javascript',
    mode: 'interview',
    title: 'Two Sum',
    source: 'interview/twoSum.js',
    code: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}`
  },
  {
    id: 'js-int-02',
    language: 'javascript',
    mode: 'interview',
    title: 'Max Subarray',
    source: 'interview/maxSubarray.js',
    code: `function maxSubarray(nums) {
  let best = nums[0];
  let cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}`
  },
  {
    id: 'js-int-03',
    language: 'javascript',
    mode: 'interview',
    title: 'Valid Parentheses',
    source: 'interview/isValid.js',
    code: `function isValid(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
    else if (!stack.length || stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}`
  },
  {
    id: 'java-int-01',
    language: 'java',
    mode: 'interview',
    title: 'Two Sum',
    source: 'interview/TwoSum.java',
    code: `int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int need = target - nums[i];
        if (seen.containsKey(need)) return new int[]{seen.get(need), i};
        seen.put(nums[i], i);
    }
    return new int[]{};
}`
  },
  {
    id: 'java-int-02',
    language: 'java',
    mode: 'interview',
    title: 'Max Subarray',
    source: 'interview/MaxSubarray.java',
    code: `int maxSubarray(int[] nums) {
    int best = nums[0], cur = nums[0];
    for (int i = 1; i < nums.length; i++) {
        cur = Math.max(nums[i], cur + nums[i]);
        best = Math.max(best, cur);
    }
    return best;
}`
  },
  {
    id: 'java-int-03',
    language: 'java',
    mode: 'interview',
    title: 'Valid Parentheses',
    source: 'interview/IsValid.java',
    code: `boolean isValid(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    for (char ch : s.toCharArray()) {
        if (ch == '(' || ch == '[' || ch == '{') {
            stack.push(ch);
        } else if (stack.isEmpty()) {
            return false;
        } else if (ch == ')' && stack.pop() != '(') {
            return false;
        } else if (ch == ']' && stack.pop() != '[') {
            return false;
        } else if (ch == '}' && stack.pop() != '{') {
            return false;
        }
    }
    return stack.isEmpty();
}`
  },
  {
    id: 'cpp-int-01',
    language: 'c++',
    mode: 'interview',
    title: 'Two Sum',
    source: 'interview/twoSum.cpp',
    code: `std::vector<int> twoSum(std::vector<int>& nums, int target) {
    std::unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); i++) {
        int need = target - nums[i];
        auto it = seen.find(need);
        if (it != seen.end()) return {it->second, i};
        seen[nums[i]] = i;
    }
    return {};
}`
  },
  {
    id: 'cpp-int-02',
    language: 'c++',
    mode: 'interview',
    title: 'Max Subarray',
    source: 'interview/maxSubarray.cpp',
    code: `int maxSubarray(std::vector<int>& nums) {
    int best = nums[0], cur = nums[0];
    for (size_t i = 1; i < nums.size(); i++) {
        cur = std::max(nums[i], cur + nums[i]);
        best = std::max(best, cur);
    }
    return best;
}`
  },
  {
    id: 'cpp-int-03',
    language: 'c++',
    mode: 'interview',
    title: 'Valid Parentheses',
    source: 'interview/isValid.cpp',
    code: `bool isValid(const std::string& s) {
    std::vector<char> stack;
    for (char ch : s) {
        if (ch == '(' || ch == '[' || ch == '{') {
            stack.push_back(ch);
        } else if (stack.empty()) {
            return false;
        } else if (ch == ')' && stack.back() == '(') {
            stack.pop_back();
        } else if (ch == ']' && stack.back() == '[') {
            stack.pop_back();
        } else if (ch == '}' && stack.back() == '{') {
            stack.pop_back();
        } else {
            return false;
        }
    }
    return stack.empty();
}`
  },
  {
    id: 'rs-int-01',
    language: 'rust',
    mode: 'interview',
    title: 'Two Sum',
    source: 'interview/two_sum.rs',
    code: `fn two_sum(nums: &[i32], target: i32) -> Vec<usize> {
    let mut seen = std::collections::HashMap::new();
    for (i, &num) in nums.iter().enumerate() {
        let need = target - num;
        if let Some(&j) = seen.get(&need) {
            return vec![j, i];
        }
        seen.insert(num, i);
    }
    vec![]
}`
  },
  {
    id: 'rs-int-02',
    language: 'rust',
    mode: 'interview',
    title: 'Max Subarray',
    source: 'interview/max_subarray.rs',
    code: `fn max_subarray(nums: &[i32]) -> i32 {
    let mut best = nums[0];
    let mut cur = nums[0];
    for &x in &nums[1..] {
        cur = x.max(cur + x);
        best = best.max(cur);
    }
    best
}`
  },
  {
    id: 'rs-int-03',
    language: 'rust',
    mode: 'interview',
    title: 'Valid Parentheses',
    source: 'interview/is_valid.rs',
    code: `fn is_valid(s: &str) -> bool {
    let mut stack = Vec::new();
    for ch in s.chars() {
        if ch == '(' || ch == '[' || ch == '{' {
            stack.push(ch);
        } else if stack.is_empty()
            || (ch == ')' && stack.pop() != Some('('))
            || (ch == ']' && stack.pop() != Some('['))
            || (ch == '}' && stack.pop() != Some('{'))
        {
            return false;
        }
    }
    stack.is_empty()
}`
  },
  {
    id: 'sql-int-01',
    language: 'sql',
    mode: 'interview',
    title: 'Running Total',
    source: 'interview/running_total.sql',
    code: `SELECT id, amount,
       SUM(amount) OVER (
         ORDER BY ts
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_total
FROM payments;`
  },
  {
    id: 'sql-int-02',
    language: 'sql',
    mode: 'interview',
    title: 'Top N Per Group',
    source: 'interview/top_n_per_group.sql',
    code: `WITH ranked AS (
  SELECT id, dept_id, salary,
         RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS r
  FROM employees
)
SELECT id, dept_id, salary
FROM ranked
WHERE r <= 3;`
  },
  {
    id: 'sql-int-03',
    language: 'sql',
    mode: 'interview',
    title: 'Streak Islands',
    source: 'interview/streak_islands.sql',
    code: `SELECT user_id,
       MIN(day) AS streak_start,
       MAX(day) AS streak_end,
       COUNT(*) AS streak_len
FROM (
  SELECT user_id, day,
         day - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day) AS grp
  FROM logins
) d
GROUP BY user_id, grp;`
  }
];
