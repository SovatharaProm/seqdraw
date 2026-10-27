export const EXAMPLES: { name: string; group: 'Sequence' | 'Flowchart'; code: string }[] = [
  {
    name: 'Login flow',
    group: 'Sequence',
    code: `sequenceDiagram
    title Login flow
    autonumber
    actor U as User
    participant B as Browser
    participant API
    participant DB@{ "type": "database" } as Database
    U->>B: Enter credentials
    B->>+API: POST /login
    API->>+DB: Find user
    DB-->>-API: User record
    alt password ok
        API-->>B: 200 + session token
        Note right of B: Token kept in memory
    else wrong password
        API-->>B: 401 Unauthorized
    end
    deactivate API
    B-->>U: Show result`,
  },
  {
    name: 'Prize redemption',
    group: 'Sequence',
    code: `sequenceDiagram
    actor Admin
    participant Portal
    participant App as Dealer App
    participant API as DEP API
    participant DB as DEP DB
    autonumber

    Admin->>Portal: Redemption history (prize, qty)
    Admin->>Admin: Prepare full quantity
    Admin->>Portal: Approve + set expected delivery
    Portal->>+API: Update redemption
    API->>DB: status = AVAILABLE
    API-->>-Portal: OK
    Portal-)App: Notify dealer
    Note over App,API: Dealer confirms receipt in the app
    App->>API: Confirm received
    API->>DB: status = RECEIVED`,
  },
  {
    name: 'Basic',
    group: 'Sequence',
    code: `sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice-)John: See you later!`,
  },
  {
    name: 'Loops & notes',
    group: 'Sequence',
    code: `sequenceDiagram
    participant Client
    participant Server
    Note over Client,Server: WebSocket session
    loop Every 30 seconds
        Client->>Server: ping
        Server-->>Client: pong
    end
    opt Server overloaded
        Server-xClient: close(1013)
    end
    Client->>Client: Schedule reconnect`,
  },
  {
    name: 'Parallel',
    group: 'Sequence',
    code: `sequenceDiagram
    participant Checkout
    participant Payments
    participant Inventory
    participant Email
    Checkout->>+Payments: Charge card
    par Reserve stock
        Checkout->>Inventory: Reserve items
    and Notify
        Checkout->>Email: Send receipt
    end
    Payments-->>-Checkout: Charged`,
  },
  {
    name: 'Order process',
    group: 'Flowchart',
    code: `flowchart TD
    Start([Order received]) --> Stock{In stock?}
    Stock -->|yes| Pay[Charge card]
    Stock -->|no| Back[Back-order]
    Pay --> Ok{Payment ok?}
    Ok -->|yes| Ship[[Ship order]]
    Ok -->|no| Notify[/Email customer/]
    Back --> Notify
    Ship --> Done([Done])
    Notify --> Done`,
  },
  {
    name: 'CI pipeline (subgraphs)',
    group: 'Flowchart',
    code: `flowchart LR
    Push([git push]) --> Build
    subgraph ci [Continuous integration]
        Build[Build] --> Test[Unit tests]
        Test --> Lint[Lint]
    end
    subgraph cd [Delivery]
        Stage[Deploy staging] -.-> Smoke{Smoke ok?}
        Smoke ==>|yes| Prod[(Production)]
    end
    Lint --> Stage
    Smoke -->|no| Push`,
  },
];
