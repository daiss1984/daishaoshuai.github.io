---
title: Spring Boot Design Patterns
date: 2026-07-18
description: The design patterns that power Spring Boot — IoC, Proxy, Template, Strategy, Observer, Chain of Responsibility, and more, with real source code references.
---

# Spring Boot Design Patterns

Spring Boot isn't just a framework — it's a masterclass in design patterns. Understanding the patterns behind Spring makes you a better developer, whether you're debugging, extending, or designing your own systems. This article covers 10 key patterns with real Spring examples.

## 1. IoC / Dependency Injection (The Foundation)

Not a GoF pattern, but the architectural core of Spring.

```java
// Without DI — tight coupling
public class OrderService {
    private OrderRepository repo = new MySQLOrderRepository(); // hard-wired
}

// With DI — loose coupling
@Service
public class OrderService {
    private final OrderRepository repo;

    public OrderService(OrderRepository repo) {  // injected
        this.repo = repo;
    }
}
```

Spring's **IoC Container** (`ApplicationContext`) creates, wires, and manages beans. You declare what you need; Spring figures out how to provide it.

| Concept | Spring Implementation |
|---------|----------------------|
| IoC Container | `ApplicationContext` / `BeanFactory` |
| Bean definition | `@Component`, `@Service`, `@Repository`, `@Bean` |
| Wiring | `@Autowired`, constructor injection |
| Lifecycle | `@PostConstruct`, `@PreDestroy`, `InitializingBean` |

## 2. Singleton

By default, every Spring bean is a **singleton** — one instance per container.

```java
@Component
public class UserService { }

// Both references point to the same object
UserService s1 = context.getBean(UserService.class);
UserService s2 = context.getBean(UserService.class);
System.out.println(s1 == s2); // true
```

Spring's singleton is **per container**, not per JVM — different from the GoF singleton. You can change scope with `@Scope("prototype")`, `@Scope("request")`, etc.

## 3. Factory Pattern

Spring's entire bean creation pipeline is a factory.

```java
// BeanFactory — the root factory interface
public interface BeanFactory {
    Object getBean(String name);
    <T> T getBean(Class<T> requiredType);
    boolean containsBean(String name);
}

// ApplicationContext extends BeanFactory with more features
ApplicationContext ctx = SpringApplication.run(MyApp.class, args);
UserService service = ctx.getBean(UserService.class);
```

Beyond the core, `FactoryBean<T>` lets you customize bean creation:

```java
@Component
public class RestTemplateFactory implements FactoryBean<RestTemplate> {
    @Override
    public RestTemplate getObject() {
        return new RestTemplateBuilder()
            .setConnectTimeout(Duration.ofSeconds(5))
            .setReadTimeout(Duration.ofSeconds(5))
            .build();
    }

    @Override
    public Class<?> getObjectType() {
        return RestTemplate.class;
    }
}
```

## 4. Proxy Pattern (AOP)

The most powerful pattern in Spring. Proxies enable `@Transactional`, `@Cacheable`, `@Async`, security annotations, and more.

```java
@Service
public class UserService {
    @Transactional  // Spring creates a proxy that wraps this method
    public void transfer(Account from, Account to, BigDecimal amount) {
        from.debit(amount);
        to.credit(amount);
    }
}
```

What actually happens:

```
Client → [Proxy] → beginTx() → UserService.transfer() → commit/rollback → return
```

Spring creates a proxy (JDK dynamic proxy for interfaces, CGLIB for classes) that intercepts the call, manages the transaction, and delegates to your real method.

```
┌──────────────────────────────────────┐
│           Client                     │
│              │                       │
│              ▼                       │
│  ┌───────────────────────┐           │
│  │   Proxy (generated)   │           │
│  │  ┌─────────────────┐  │           │
│  │  │ TransactionInterceptor      │  │
│  │  │ 1. begin Tx      │  │           │
│  │  │ 2. call target   │──┼──► Real UserService
│  │  │ 3. commit/rollback│  │           │
│  │  └─────────────────┘  │           │
│  └───────────────────────┘           │
└──────────────────────────────────────┘
```

Common Spring features built on proxies:

| Annotation | What the proxy does |
|------------|---------------------|
| `@Transactional` | Begin/commit/rollback transaction |
| `@Cacheable` | Check cache → call method → store result |
| `@Async` | Submit to `TaskExecutor`, return immediately |
| `@PreAuthorize` | Check authentication before method call |
| `@Retryable` | Retry on failure |

## 5. Template Method

Spring uses the template pattern extensively to eliminate boilerplate:

```java
// JdbcTemplate — you write the query, Spring handles connections, cleanup
jdbcTemplate.query("SELECT * FROM users WHERE age > ?", rs -> {
    return new User(rs.getLong("id"), rs.getString("name"));
}, 18);

// Behind the scenes: getConnection → execute → map results → close connection
```

Common Spring templates:

| Template | What it eliminates |
|----------|-------------------|
| `JdbcTemplate` | Connection open/close, try-catch, ResultSet iteration |
| `RestTemplate` | HTTP connection management, serialization/deserialization |
| `JmsTemplate` | JMS session/connection lifecycle |
| `TransactionTemplate` | Programmatic transaction begin/commit/rollback |
| `RedisTemplate` | Redis connection pooling, serialization |

The pattern:

```java
public abstract class AbstractTemplate {
    public final Result execute(Input input) {
        setup();              // fixed steps
        Result r = doWork();  // subclass implements
        teardown();           // fixed steps
        return r;
    }
    protected abstract Result doWork();
}
```

## 6. Strategy Pattern

Spring lets you swap implementations without changing calling code:

```java
// Multiple implementations of the same interface
@Service
public class WechatPayService implements PaymentService { ... }

@Service
public class AlipayService implements PaymentService { ... }

// Spring picks the right one based on qualifier or condition
@RestController
public class PaymentController {
    @Autowired
    @Qualifier("wechatPayService")
    private PaymentService paymentService;
}
```

`ResourceLoader` is another classic example:

```java
Resource resource = resourceLoader.getResource("classpath:data.sql");
Resource resource = resourceLoader.getResource("file:/etc/config.yml");
Resource resource = resourceLoader.getResource("https://example.com/api");
// Same interface, different strategy based on URL prefix
```

## 7. Observer / Event Listener

Spring's event system is a clean implementation of the Observer pattern:

```java
// 1. Define an event
public class OrderCreatedEvent extends ApplicationEvent {
    private final Order order;
    public OrderCreatedEvent(Object source, Order order) {
        super(source);
        this.order = order;
    }
}

// 2. Publish
@Component
public class OrderService {
    @Autowired
    private ApplicationEventPublisher publisher;

    public void createOrder(Order order) {
        // save order...
        publisher.publishEvent(new OrderCreatedEvent(this, order));
    }
}

// 3. Listen — completely decoupled
@Component
public class OrderNotificationListener {
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        // send email, SMS, push notification...
    }
}
```

Spring Boot also supports `@TransactionalEventListener` — the listener fires only after the transaction commits, preventing notifications for rolled-back operations.

## 8. Chain of Responsibility

Servlet Filters and Spring Interceptors form a chain:

```java
// Filter chain (Servlet level)
@Component
public class LoggingFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        log.info("Before");
        chain.doFilter(req, res);  // pass to next filter or servlet
        log.info("After");
    }
}

// Interceptor chain (Spring MVC level)
@Component
public class AuthInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        // return false to stop the chain
        return req.getHeader("Authorization") != null;
    }
}
```

```
Request → Filter1 → Filter2 → DispatcherServlet → Interceptor1 → Interceptor2 → Controller
```

Spring Security's `SecurityFilterChain` is another chain-of-responsibility implementation — each filter checks one aspect (authentication, CSRF, CORS, etc.).

## 9. Adapter Pattern

Spring MVC's `HandlerAdapter` decouples the `DispatcherServlet` from different handler types:

```java
// DispatcherServlet doesn't know what a handler looks like
for (HandlerAdapter adapter : handlerAdapters) {
    if (adapter.supports(handler)) {
        return adapter.handle(request, response, handler);
    }
}
```

Different adapters handle different handler styles:

| HandlerAdapter | Handles |
|----------------|---------|
| `RequestMappingHandlerAdapter` | `@RequestMapping` methods in `@Controller` |
| `HttpRequestHandlerAdapter` | `HttpRequestHandler` implementations |
| `SimpleControllerHandlerAdapter` | Legacy `Controller` interface |

## 10. Builder Pattern

Spring Boot embraces builders for configuration:

```java
// SpringApplicationBuilder
new SpringApplicationBuilder()
    .sources(MyApp.class)
    .profiles("dev")
    .bannerMode(Banner.Mode.OFF)
    .run(args);

// MockMvcBuilder for testing
mockMvc.perform(get("/api/users")
    .header("Authorization", "Bearer token")
    .param("page", "0"));

// SecurityFilterChain builder
http
    .authorizeHttpRequests(auth -> auth
        .requestMatchers("/api/public/**").permitAll()
        .anyRequest().authenticated()
    )
    .oauth2Login(Customizer.withDefaults());
```

## 11. Bonus: Object Pool

Database connection pooling (HikariCP, the Spring Boot default):

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      idle-timeout: 300000
```

Instead of creating/destroying expensive DB connections, a pool maintains ready-to-use connections — the Object Pool pattern in action.

## 12. Pattern Map

| Pattern | Where in Spring Boot |
|---------|---------------------|
| **IoC / DI** | `ApplicationContext`, `@Autowired` |
| **Singleton** | Default bean scope |
| **Factory** | `BeanFactory`, `FactoryBean<T>` |
| **Proxy** | AOP, `@Transactional`, `@Cacheable` |
| **Template Method** | `JdbcTemplate`, `RestTemplate`, `*Template` |
| **Strategy** | `@Qualifier`, `ResourceLoader` |
| **Observer** | `ApplicationEvent`, `@EventListener` |
| **Chain of Responsibility** | Filter chain, Interceptor chain, Security |
| **Adapter** | `HandlerAdapter` in Spring MVC |
| **Builder** | `SpringApplicationBuilder`, DSL configs |
| **Object Pool** | HikariCP connection pool |

## 13. Summary

- Spring Boot **is** design patterns in practice. Recognizing them helps you read source code, debug issues, and extend the framework.
- **IoC + Singleton + Factory** form the bean lifecycle backbone.
- **Proxy + Template Method + Chain of Responsibility** handle cross-cutting concerns transparently.
- **Strategy + Observer + Adapter** decouple components for pluggability.
- Next time you use `@Transactional`, know that a Proxy is at work. Next time you call `jdbcTemplate.query()`, you're using Template Method.
