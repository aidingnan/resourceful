<font size=7>Resource Protocol, or RP</font>

# Overview

RP是一个基于资源模型和资源操作语义定义的双向通讯接口协议。

RP需要通讯的双方预先建立一个有质量的传输层连接，可以是TCP/TLS，操作系统的IPC，或者硬件数据链路层连接。

RP在该连接之上实现自定义的Message传递；一个Message序列构成一个单向的Stream；多个Stream可以交错发送，相当于内置支持mux/demux。

但RP里没有Duplex Stream，两个单向的Stream足够完成request/response模式。

Stream本身也是资源，对Stream的操作，例如Flow Control或者Abort，可使用资源操作方式；RP不需要象很多通讯协议那样区分控制包或者数据包，RP没有控制包。

基于Stream，RP可以实现类似HTTP的Request/Response模式，D-BUS的Signal，Socket或者WebSocket的Notification等业务需求。

RP设计极为简单，对Node和JavaScript友好，其Message使用JSON格式定义和传输。

# Resource Identifier, or Path

在RP中，从通讯的双方中的任何一方看另外一方，都象一个RESTful方式描述的层级资源，访问这些资源都是使用资源操作原语加上资源标识。

在HTTP协议中，只有Server角色需要这样表述所有资源；但在RP中，即使一方只是“客户端”，RP也要求它维护自己的资源命名空间（namespace），因为，RP用资源表述一切，包括Stream本身也是一种运行时（runtime）资源，有唯一资源标识。

# Message Passing

Message是一方向另一方发送数据的基本单元；一个Message最基本的属性是“源地址”和“目标地址”，用JSON表述如下：

```json
{
    "to": "/accounts/B223344",
    "from": "/#requests/A123456",
    "others": "..."
}
```

RP在强调“一切皆资源”的设计理念。

Message里的`to`和`from`都用Path标识，`to`使用Path有合理性，`from`使用Path的必要性在下一节说明。

# Stream

如果一个序列的Message，从A发送给B，有着相同的`to`和`from`属性，这些Message就构成了一个单向的Stream。

Stream可以不结束，这适合那些Notification的应用；Stream结束采用类似EoF的逻辑，在最后一个Message里标记`end`属性为`true`。

Stream也可以只包含一个Message，适合仅交换少量JSON数据的场合。

## Stream as a Resource

一个Stream本身也是一个Resource；它的Owner是Source而不是Sink，这很容易理解，因为如果要操作一个Stream，比如Cancel或者Pause，肯定是去Source操作而不是Sink。

这是为什么Message里`from`字段需要一个Path标识的第一个原因，而且这个标识必须唯一。我们看一个例子。

比如类似HTTP Request的请求，基于RP只有单向Stream了，在Server端应答时需要有客户端访问点；这里就需要Client临时创建一个唯一的资源标识，以此作为`from`字段发给对方；这和TCP的ephemeral port是一回事。

通常这个访问点的位置不重要，习惯上可以放在下面这样一个位置；

```
/#requests/1234567      (Client Side) 
```

如果Server提供服务的资源路径是：

```
/app/members/1234       (Server Side) 
```

请注意，Server不能直接使用这个Path作为返回的Message中的`from`，因为Server可以同时有多个返回的数据流，这个标识不唯一！

Server需要即时创建一个Path，返回的Message的`to`和`from`看起来大概是：

```json
{
    "to": "/#requests/1234567",
    "from": "/app/members/1234/#responses/5678"
}
```

这样这个`from`是一个唯一标识；这里使用`#`标识那些动态的资源，仅用于说明，最终协议格式可能改变。

> Stream Source Path必须Unique，但Sink不必，几乎所有Path都是Sink，允许多连接的并发访问。

## Flow Control, Cancel

当Stream本身已经是一个资源时，对Stream的控制就可以沿用资源操作语义，下面的例子试图实现流控，Pause上面一个例子中的流：

```json
{
    "to": "/app/members/1234/#responses/5678/#flow",
    "from": "...",
    "verb": "UPDATE",
    "value": false,
    "noReply": true,
    "eof": true
}
```

当把流也资源化表述之后，我们并不需要经常使用的“控制”指令去改变一些动态资源。

同样的，Cancel这个流也只需要用标准的`DELETE`操作即可，这比维护双方有态的双向流方便太多了。这是

# VERBs

VERBs没有什么讨论的必要，GET/POST/PUT/PATCH/DELETE只是CRUD的另一种说法。

# Push & PubSub & Hook & Others

Push vs Pull其实是个伪概念；RP鼓励使用动态的资源标识，比如：

`/file-system-home/a-subirectory/#changes`

`GET`一次这个资源，然后被分配一个返回的Stream，这个Stream是Endless的就可以做到所谓的Notification；因为共用一个Transport连接，去`GET`多个资源节点不是问题。

如果需要绝对的节省资源（主要是节省服务器端资源），客户端设备可以注册一个自己的URI到服务器上，在服务器上有消息到达时来调用这个就可以了，类似HTTP Hook。

同样的所谓PubSub也是可以完全用资源语义实现的，区别主要在服务器端不在客户端。

RP只需要一个Transport连接，不需要HTTP, MQTT, SOCKET等上一堆东西。






