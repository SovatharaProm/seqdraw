export const EXAMPLES: { name: string; code: string }[] = [
  {
    name: 'Login flow',
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
    name: 'Prize redemption (redux-color)',
    code: `---
config:
  theme: redux-color
---
sequenceDiagram
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
    code: `sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice-)John: See you later!`,
  },
  {
    name: 'Loops & notes',
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
    name: 'Blank',
    code: `sequenceDiagram
    `,
  },
];
