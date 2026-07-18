---
title: Spring Boot 设计模式
date: 2026-07-18
description: Spring Boot 中无处不在的设计模式 —— IoC、代理、模板、策略、观察者、责任链等，结合源码实例讲解。
---

# Spring Boot 设计模式

Spring Boot 不只是一个框架——它是一部设计模式的教科书。理解 Spring 背后的模式，无论你是调试源码、扩展框架还是设计自己的系统，都能让你更上一层楼。本文涵盖 10 个关键模式，全部结合实际 Spring 示例。

## 1. IoC / 依赖注入（基石）

不是 GoF 模式，但它是 Spring 的架构核心。

```java
// 没有 DI —— 紧耦合
public class OrderService {
    private OrderRepository repo = new MySQLOrderRepository(); // 写死了
}

// 有 DI —— 松耦合
@Service
public class OrderService {
    private final OrderRepository repo;

    public OrderService(OrderRepository repo) {  // 注入
        this.repo = repo;
    }
}
```

Spring 的 **IoC 容器**（`ApplicationContext`）负责创建、装配和管理 Bean。你声明需要什么，Spring 负责提供。

| 概念 | Spring 实现 |
|------|-------------|
| IoC 容器 | `ApplicationContext` / `BeanFactory` |
| Bean 定义 | `@Component`、`@Service`、`@Repository`、`@Bean` |
| 装配 | `@Autowired`、构造器注入 |
| 生命周期 | `@PostConstruct`、`@PreDestroy`、`InitializingBean` |

## 2. 单例（Singleton）

默认情况下，每个 Spring Bean 都是**单例**——每个容器只有一个实例。

```java
@Component
public class UserService { }

// 两个引用指向同一个对象
UserService s1 = context.getBean(UserService.class);
UserService s2 = context.getBean(UserService.class);
System.out.println(s1 == s2); // true
```

Spring 的单例是**每个容器**一个实例，不是每个 JVM 一个——这和 GoF 的单例不同。可以通过 `@Scope("prototype")`、`@Scope("request")` 等改变作用域。

## 3. 工厂模式（Factory）

Spring 的整个 Bean 创建流程就是一个大工厂。

```java
// BeanFactory —— 根工厂接口
public interface BeanFactory {
    Object getBean(String name);
    <T> T getBean(Class<T> requiredType);
    boolean containsBean(String name);
}

// ApplicationContext 在 BeanFactory 基础上扩展了更多功能
ApplicationContext ctx = SpringApplication.run(MyApp.class, args);
UserService service = ctx.getBean(UserService.class);
```

除此之外，`FactoryBean<T>` 还可以自定义 Bean 的创建过程：

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

## 4. 代理模式（AOP）

Spring 中最强大的模式。代理支撑了 `@Transactional`、`@Cacheable`、`@Async`、安全注解等一切。

```java
@Service
public class UserService {
    @Transactional  // Spring 创建一个代理来包装这个方法
    public void transfer(Account from, Account to, BigDecimal amount) {
        from.debit(amount);
        to.credit(amount);
    }
}
```

实际发生了什么：

```
客户端 → [代理] → beginTx() → UserService.transfer() → commit/rollback → 返回
```

Spring 创建代理（有接口用 JDK 动态代理，无接口用 CGLIB），拦截调用、管理事务、再委托给真实方法。

```
┌──────────────────────────────────────┐
│           客户端                     │
│              │                       │
│              ▼                       │
│  ┌───────────────────────┐           │
│  │   代理（动态生成）     │           │
│  │  ┌─────────────────┐  │           │
│  │  │ TransactionInterceptor      │  │
│  │  │ 1. 开启事务      │  │           │
│  │  │ 2. 调用目标方法  │──┼──► 真正的 UserService
│  │  │ 3. 提交/回滚     │  │           │
│  │  └─────────────────┘  │           │
│  └───────────────────────┘           │
└──────────────────────────────────────┘
```

基于代理的常用 Spring 功能：

| 注解 | 代理做了什么 |
|------|-------------|
| `@Transactional` | 开启/提交/回滚事务 |
| `@Cacheable` | 查缓存 → 调方法 → 存结果 |
| `@Async` | 提交到 `TaskExecutor`，立即返回 |
| `@PreAuthorize` | 方法调用前检查权限 |
| `@Retryable` | 失败时重试 |

## 5. 模板方法（Template Method）

Spring 大量使用模板模式来消除样板代码：

```java
// JdbcTemplate —— 你写查询，Spring 处理连接、清理
jdbcTemplate.query("SELECT * FROM users WHERE age > ?", rs -> {
    return new User(rs.getLong("id"), rs.getString("name"));
}, 18);

// 背后：获取连接 → 执行 → 映射结果 → 关闭连接
```

Spring 中的常见模板：

| 模板 | 消除了什么 |
|------|-----------|
| `JdbcTemplate` | 连接开关、try-catch、ResultSet 遍历 |
| `RestTemplate` | HTTP 连接管理、序列化/反序列化 |
| `JmsTemplate` | JMS 会话/连接生命周期 |
| `TransactionTemplate` | 编程式事务的 begin/commit/rollback |
| `RedisTemplate` | Redis 连接池、序列化 |

模式结构：

```java
public abstract class AbstractTemplate {
    public final Result execute(Input input) {
        setup();              // 固定步骤
        Result r = doWork();  // 子类实现
        teardown();           // 固定步骤
        return r;
    }
    protected abstract Result doWork();
}
```

## 6. 策略模式（Strategy）

Spring 让你在不改调用方代码的情况下替换实现：

```java
// 同一接口的多种实现
@Service
public class WechatPayService implements PaymentService { ... }

@Service
public class AlipayService implements PaymentService { ... }

// Spring 根据限定符或条件选择
@RestController
public class PaymentController {
    @Autowired
    @Qualifier("wechatPayService")
    private PaymentService paymentService;
}
```

`ResourceLoader` 是另一个经典例子：

```java
Resource resource = resourceLoader.getResource("classpath:data.sql");
Resource resource = resourceLoader.getResource("file:/etc/config.yml");
Resource resource = resourceLoader.getResource("https://example.com/api");
// 同样的接口，根据 URL 前缀选择不同策略
```

## 7. 观察者 / 事件监听（Observer）

Spring 的事件系统是观察者模式的优雅实现：

```java
// 1. 定义事件
public class OrderCreatedEvent extends ApplicationEvent {
    private final Order order;
    public OrderCreatedEvent(Object source, Order order) {
        super(source);
        this.order = order;
    }
}

// 2. 发布
@Component
public class OrderService {
    @Autowired
    private ApplicationEventPublisher publisher;

    public void createOrder(Order order) {
        // 保存订单...
        publisher.publishEvent(new OrderCreatedEvent(this, order));
    }
}

// 3. 监听 —— 完全解耦
@Component
public class OrderNotificationListener {
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        // 发邮件、短信、推送...
    }
}
```

Spring Boot 还支持 `@TransactionalEventListener`——监听器只在事务提交后才触发，避免为回滚操作发送通知。

## 8. 责任链（Chain of Responsibility）

Servlet Filter 和 Spring Interceptor 组成了处理链：

```java
// Filter 链（Servlet 层）
@Component
public class LoggingFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        log.info("请求进入");
        chain.doFilter(req, res);  // 传给下一个 filter 或 servlet
        log.info("响应返回");
    }
}

// Interceptor 链（Spring MVC 层）
@Component
public class AuthInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        // 返回 false 可中断整个链
        return req.getHeader("Authorization") != null;
    }
}
```

```
请求 → Filter1 → Filter2 → DispatcherServlet → Interceptor1 → Interceptor2 → Controller
```

Spring Security 的 `SecurityFilterChain` 也是责任链实现——每个 filter 检查一个方面（认证、CSRF、CORS 等）。

## 9. 适配器模式（Adapter）

Spring MVC 的 `HandlerAdapter` 将 `DispatcherServlet` 与不同的 handler 类型解耦：

```java
// DispatcherServlet 不知道 handler 长什么样
for (HandlerAdapter adapter : handlerAdapters) {
    if (adapter.supports(handler)) {
        return adapter.handle(request, response, handler);
    }
}
```

不同适配器处理不同风格的 handler：

| HandlerAdapter | 处理 |
|----------------|------|
| `RequestMappingHandlerAdapter` | `@Controller` 中的 `@RequestMapping` 方法 |
| `HttpRequestHandlerAdapter` | `HttpRequestHandler` 实现 |
| `SimpleControllerHandlerAdapter` | 旧版 `Controller` 接口 |

## 10. 建造者模式（Builder）

Spring Boot 钟爱 Builder 模式来做配置：

```java
// SpringApplicationBuilder
new SpringApplicationBuilder()
    .sources(MyApp.class)
    .profiles("dev")
    .bannerMode(Banner.Mode.OFF)
    .run(args);

// MockMvcBuilder 用于测试
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

## 11. 附赠：对象池（Object Pool）

数据库连接池（Spring Boot 默认使用 HikariCP）：

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      idle-timeout: 300000
```

与其反复创建和销毁昂贵的数据库连接，不如维护一个可随时取用的连接池——这就是对象池模式。

## 12. 模式全景图

| 模式 | Spring Boot 中的位置 |
|------|---------------------|
| **IoC / DI** | `ApplicationContext`、`@Autowired` |
| **单例** | 默认 Bean 作用域 |
| **工厂** | `BeanFactory`、`FactoryBean<T>` |
| **代理** | AOP、`@Transactional`、`@Cacheable` |
| **模板方法** | `JdbcTemplate`、`RestTemplate`、`*Template` |
| **策略** | `@Qualifier`、`ResourceLoader` |
| **观察者** | `ApplicationEvent`、`@EventListener` |
| **责任链** | Filter 链、Interceptor 链、Security |
| **适配器** | Spring MVC 的 `HandlerAdapter` |
| **建造者** | `SpringApplicationBuilder`、DSL 配置 |
| **对象池** | HikariCP 连接池 |

## 13. 总结

- Spring Boot **本身就是设计模式的实践**。识别这些模式，能帮你读懂源码、排查问题、扩展框架。
- **IoC + 单例 + 工厂**构成了 Bean 生命周期的骨架。
- **代理 + 模板方法 + 责任链**透明地处理横切关注点。
- **策略 + 观察者 + 适配器**实现组件解耦和可插拔。
- 下次用 `@Transactional` 时，知道背后是代理在工作；调用 `jdbcTemplate.query()` 时，你在用模板方法。
