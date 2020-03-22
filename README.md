<font size=7>Resource Protocol, or RP</font>

# Overview

RP是一个基于资源模型和资源操作语义定义的双向通讯接口协议。

RP需要通讯的双方预先建立一个有质量的传输层连接，可以是TCP/TLS，操作系统的IPC，或者硬件数据链路层连接。

RP在该连接之上定义一方向另一方的Message Passing；包含一个或多个Message的序列构成一个单向Stream；在传输层，同时发送的多个Stream的Message可以交替（interleaving）发送，相当于协议支持multiplexing。

在RP里，Stream本身也是资源，由发送方提供资源标识并实现资源操作，这样象Pause/Resume或Cancel一个Stream等操作，无需额外定义Message类型，可直接使用资源操作方式。

RP里没有双向Stream，所有业务目标均通过组合单向Stream完成，在状态维护上更简单。

RP的Stream可以是Object Stream，或者Blob Stream，或者两者混合；但一个Message仅能包含一个Object或者一个Blob。

基于Stream，RP可以实现HTTP的Request/Response模式，D-BUS的Method和Signal，Socket或WebSocket的observation/notification，MQTT的PubSub语义，等业务需求。

RP设计极简单，对JavaScript友好，Message使用JSON数据格式。

> Message使用JSON可能对Load Balancer或者URL Rewrite不友好；multiple-line text更好一些。

# Resource and Resource Identifier (Path)

在RP中，从通讯的双方中的任何一方看另外一方，都是一个RESTful方式描述的层级资源；双方通讯的唯一方式是资源操作。

在HTTP协议中，只有Server端需要表述所有资源；在RP中，即使一方只是“客户端”，RP也要求它维护自己的资源命名空间（namespace），因为双方通讯是使用单向Stream完成，Stream的源和目标都需要资源标识工作；对于“客户端”，它需要发出请求时创建一个Stream，该Stream需要有资源标识（该资源是Source），同时创建一个资源用于接受可能得到的返回结果（该资源是Sink）。

在RP里，*everything is a resource*，包括动态（run-time）的状态，例如Stream，例如一个资源的持续变化（观察），RP鼓励开发者用资源描述一切业务要求并使用RESTful操作访问资源完成业务，避免重新发明语义。

唯一可能的约定，是资源命名方式的约定，naming convention，就像Unix操作系统里用户目录在`/home`目录下。

# Message & Message Passing

Message是一方向另一方发送数据的基本单元；一个Message最基本的属性是目标资源标识`to`和源资源标识`from`：

```json
{
    "to": "/accounts/B223344",
    "from": "/#requests/A123456",
    "others": "..."
}
```

Message需要目标资源标识的原因是显而易见的；需要标注源资源标识的做法不常见。

因为在RP里只有资源标识，没有地址、端口等概念，如果要构筑请求/应答模式，发起请求的一方必须提供源资源标识`from`，供另一方应答时作为目标资源`to`；这是第一个原因；第二个原因，如果请求不是单一Message，而是一个Message序列，即Stream，如前所述，如果要Pause/Resume这个Stream，也需要Stream的资源标识。

# Stream

如果从一方发送给另一方的一个Message序列，都有着相同的目标资源标识`to`和源资源标识`from`，这些Message就构成一个单向Stream。

Stream结束采用EoF的逻辑，在最后一个Message里标记`end`为`true`；Stream可以永不结束，适合那些需要Observation或Notification的业务场景。

Stream可以只包含一个Message。

## Stream as a Resource

一个Stream本身也是一个Resource；它的Owner是Source而不是Sink，因为如果要操作一个Stream，比如Cancel或者Pause，肯定是去Source一方操作。

看一个例子。

比如发起请求的一方，要分配一个临时Path，位置不重要，习惯上可以放在下面这样一个位置；

```
/#requests/1234567      (Client Side) 
```

假如应答方提供服务的资源路径是：

```
/app/members/1234       (Server Side) 
```

请求方发出的Message：

```json
{
    "to": "/app/members/1234",
    "from": "/#requests/1234567",
    "verb": "GET",
    ...
}
```

注意，应答方（Server）不能直接使用资源访问点这个Path作为返回的Message中的`from`，因为可以同时有多个返回的数据流，这个标识不唯一！

应答方需要即时创建一个Path，返回的Message：

```json
{
    "to": "/#requests/1234567",
    "from": "/app/members/1234/#streams/5678"
}
```

这样这个`from`是一个唯一资源标识，它也唯一标识了这个应答的Stream。

这里暂时使用`#`标识那些动态的资源或者保留的资源命名约定，仅用于说明，最终协议格式可能改变。

## Flow Control, Cancel

因为Stream有资源标识，对Stream的控制就可以使用资源操作，下面的例子试图实现流控，Pause上面一个例子中的流：

```json
{
    "to": "/app/members/1234/#streams/5678/#flow",
    "from": "...",
    "verb": "UPDATE",
    "value": false,
    "noReply": true,
    "eof": true
}
```

类似的，Cancel这个流可以用标准的`DELETE`操作。

```
DELETE /app/members/1234/#streams/5678
```

# VERBs

VERBs没有什么讨论的必要，GET/POST/PUT/PATCH/DELETE只是CRUD的另一种说法。



# Hashtag, OOB Data or Non-Enumberable Properties

在所有的I/O设计中都会遇到Out-Of-Band (OOB)数据的问题；比如Unix File IO，如果File是一个UART设备，那还需要使用ioctl，以区分in-band数据和OOB数据。



> 这个问题在Plan9的9P文件系统中得以修正，UART驱动通过一组相关的文件节点提供服务，而不是在一个File里定义oob hooks；本质上，这也是在用资源层级结构解决问题。



RESTful仍然是I/O协议的一种，它的资源表述方式和文件系统层级也很接近；这种设计的最大好处是便于拓展，在已有资源里可以方便的添加新的资源成员，可以把Primitive类型修改成Object或者Array，这是JavaScript/JSON数据格式提供的灵活性。



但即便有这种灵活性，OOB问题仍然可能会遇到；包括JavaScript Object，也有enumerable为false的属性，目的就是把一些数据成员分类出去，不认为他们是in-band数据。



在RP里，`#`被用作一个reserved word，任何资源都有这个成员，但它是non-enumberable的，不会出现在`GET`返回的结果里；使用`GET /path/to/a/resource/#`可以获得该资源的tags列表，可以为空。



如果Path字串中的`#`后面还有其他成员，可以去掉`#`和后面成员之间的`/`，看作一个语法糖，下面这两个写法是等价的。

```
/path/to/resource/#schema
/path/to/resource/#/schema
```



建议使用tag定义在资源包含这样一些：

1. 它是一个metadata，比如任何资源都可以能提供`#schema`，描述支持的操作类型，返回数据的定义；
2. 它是一个衍生资源，并不会持久化，使用`#`比使用普通的资源名称更表达这种特性；
3. 它是一个动态的资源，RESTful本身可以表达动态，例如一个EC2服务的工作状态，不只是持久化的数据；但是一些动态资源的在生命周期上隶属于一个资源，而又不该出现在成员数据里，`#streams`是一个很好的例子；



All in all, `#`在增加了一个极少的约定的前提下，提供了给开发者为资源增加OOB数据的统一约定，这是RESTful里没有很好约定的地方。（`#`也不是一个safe的URI字符）



> 使用`#`而不是沿用`?`和Query String的原因是，`#`资源还可以进一步具有子资源，而下面这个写法看起来就很很奇怪了，也会影响Path处理的效率。

> ```
> UPDATE app/members/1234?streamId=5678/flow
> ```

在RP里每个资源都有tag，可以方便的定义OOB/Non-Enumerable数据。




# Application

## Observation /  Notification

Observation指服务端的连续推送事件变化，通常是有一定频率的，例如Google Drive有Watch API观察文件夹内资源变化。

HTTP GET本身不缺乏从服务器端持续向客户端发送数据流的能力，只是在数据格式定义中没有Object Stream的概念，需要开发者自己在两端定义和实现。

RP是直接支持返回Object Stream的，无需额外语义即可使用`GET`实现观察；RP内置支持multiplexing，无需为每个观察建立独立连接；如果对实时性有要求，可以建议一个单独的连接用于需要实时性的Notification。

和现有方案相比，RP不需要额外增加Socket，和分配Channel Id之类不在整个资源的Namespace上的资源标识。



## Web Hooks

这个真正意义上的Push在RP上很容易实现，因为RP是对称的，云可以直接调用设备上的方法，不需要有额外的tunneling或reverse proxy。

当然前提是设备与云已经建立了连接。云并没有办法发起和设备的连接。但是在物联网时代越来越多的设备会和云服务保持长连接。



## Signal是个伪概念

在D-Bus的设计上，有个重要的功能是提供Signal能力，即一个DBus Object在发生变化时其他Subscribe这个对象的这类变化，在D-Bus里是用AddMatch Rules实现的。



这里和`GET`一个资源的`#changes`资源没有本质区别，最多也就是可以一次性把一个sub-tree的所有资源节点的`#changes`都`GET`下来，这个语义很容易通过一个`#treeChanges`资源提供。



只要有Object Stream支持，Signal只是另一个说法而以；而且RESTful强制资源语义，即一个资源事件只能是`added`, `updated`, `deleted`这些，而Signal就没有这个限制。



##  Composition

RP在通讯底层使用Path，这让组合服务变得非常方便，比如一个服务可以作为facade模式，组合其他服务。

```
/hello -> 连接到操作系统内或者网络上的另一个服务端口，把所有的数据包都双向relay
/world -> 连接到操作系统内或者网络上的另一个服务端口，把所有的数据包都双向relay
```

在这种情况下，这个facade只需要rewrite资源路径即可，在数据包的Path头部增加或减少`/hello`或者`/world`前缀，没有其他额外工作需要做，这种组合在两端都可以做到，开销很低、且支持层级。



## 弱设备友好

如果一个MCU通过一个Date Link Layer接入了系统，它需要访问系统服务时也很容易，即使它和HTTP的客户端比需要维护一个额外的请求侧的Namespace。



虽然RP支持Interleaving Stream，但MCU不一定要使用这个能力，它可以用半双工方式工作；只要Message数据包容易解析，RP就可以是对弱设备很友好的；而开发上，在应答方，可以兼顾弱设备和强设备。



# Philosophy

1. 一切皆资源；
2. 一切资源皆有tag；
3. 运行时的流也是资源，同样也可以用Stateless的RESTful操作；
4. RP是对称的；如果有一个库，它就是RP库，不是RP客户端库或者服务端框架；



# Wire Format

作为一个Draft，还不需要定义详细的Message类型；可以先完成代码再说。

设计原则上，HEADER和BODY还是分离的，内嵌将会对Load Balancer或者Service Composition很不友好。

HEADER使用JSON格式肯定是JavaScript/Node程序员最开心的，但类似HTTP那样LF分割的方式对低端设备更有好一些。

这些是设计考量的因素。

在HEADER里必要的属性只有：

```
FROM: 源，也是流的资源标识
TO: 目标
VERB (GET/POST/PUT/PATCH/DELETE/REP/ERROR)
EOF标记
FLOW标记（如果想支持量化的流控，数据包上可能需要一个0~100之间的值，在某些Transport层的情况下是有用的）
BODY-LENGHT
BODY-TYPE
```

