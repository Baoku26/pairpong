;; Crypto Pong Battle - Betting Contract
;; Manages STX wagers on battle outcomes and automated payouts.

;; --- Constants ---
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-BATTLE-ENDED (err u101))
(define-constant ERR-BET-ALREADY-PLACED (err u102))
(define-constant ERR-INVALID-BET-AMOUNT (err u103))
(define-constant ERR-NO-WINNER (err u104))
(define-constant FEE-PERCENTAGE u100) ;; 1% fee (100 basis points)
(define-constant MIN-BET u1000000) ;; Minimum bet of 1 STX (1,000,000 uSTX)

;; Placeholder address for the Leaderboard contract that confirms the winner
(define-constant LEADERBOARD-CONTRACT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.battle-leaderboard)

;; Placeholder address for the protocol treasury (to receive fees)
(define-constant PROTOCOL-TREASURY 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)

;; --- Data Maps ---

;; Stores details for an active battle/betting pool
;; Key: uint (battle ID)
;; Value: {
;;   coin-a-principal: principal, ; Principal who bet on Coin A
;;   coin-b-principal: principal, ; Principal who bet on Coin B
;;   coin-a-amount: uint, ; Total wagered on Coin A
;;   coin-b-amount: uint, ; Total wagered on Coin B
;;   winner-principal: (optional principal) ; The winner of the pool
;; }
(define-map bet-pools uint {
    coin-a-principal: principal,
    coin-b-principal: principal,
    coin-a-amount: uint,
    coin-b-amount: uint,
    winner-principal: (optional principal)
})

;; Tracks the next available battle/pool ID
(define-data-var next-pool-id uint u1)

;; --- Helper Functions ---

(define-private (get-next-pool-id)
    (let ((current-id (var-get next-pool-id)))
        (var-set next-pool-id (+ current-id u1))
        current-id
    )
)

;; Calculates the fee to be taken
(define-private (calculate-fee (amount uint))
    (/ (* amount FEE-PERCENTAGE) u10000) ;; amount * 100 / 10000 = amount * 1/100 (1%)
)

;; --- Public Functions ---

;; @desc Places a wager on a coin in a new battle pool.
;; @param amount The amount of STX (in uSTX) to wager.
;; @param coin-choice-a Whether the user is betting on Coin A (true) or Coin B (false).
(define-public (place-bet
    (amount uint)
    (coin-choice-a bool)
)
    (begin
        (asserts! (>= amount MIN-BET) ERR-INVALID-BET-AMOUNT)

        (let
        (
            (pool-id (get-next-pool-id))
            (sender tx-sender)
            (empty-principal 'ST0000000000000000000000000000000000000000)
        )

        ;; Transfer STX from sender to the contract
        (try! (stx-transfer? amount sender (as-contract tx-sender)))

        ;; Initialize the pool with the first bet
        (if coin-choice-a
            (map-set bet-pools pool-id
            {
                coin-a-principal: sender,
                coin-b-principal: empty-principal,
                coin-a-amount: amount,
                coin-b-amount: u0,
                winner-principal: none
            }
            )
            (map-set bet-pools pool-id
            {
                coin-a-principal: empty-principal,
                coin-b-principal: sender,
                coin-a-amount: u0,
                coin-b-amount: amount,
                winner-principal: none
            }
            )
        )

        (ok pool-id)
        )
    )
)

;; @desc Allows a second user to join a pool and bet on the opposite side.
;; @param pool-id The ID of the pool to join.
;; @param amount The amount of STX (in uSTX) to match the wager.
(define-public (join-bet (pool-id uint) (amount uint))
    (let
        (
            (sender tx-sender)
            (current-pool (unwrap! (map-get? bet-pools pool-id) ERR-BATTLE-ENDED))
            (first-bettor (get coin-a-principal current-pool))
            (first-bet-amount (get coin-a-amount current-pool))
        )
        (asserts! (is-eq sender (get coin-b-principal current-pool)) ERR-BET-ALREADY-PLACED) ;; Prevent user from betting on the same coin again
        (asserts! (is-none (get winner-principal current-pool)) ERR-BATTLE-ENDED)
        (asserts! (is-eq amount first-bet-amount) ERR-INVALID-BET-AMOUNT) ;; Must match the first wager

        ;; Transfer STX from sender to the contract
        (try! (stx-transfer? amount sender (as-contract tx-sender)))

        ;; Update pool with the second bettor (who must bet on Coin B)
        (map-set bet-pools pool-id
        (merge current-pool
            {
            coin-b-principal: sender,
            coin-b-amount: amount,
            }
        )
        )
        (ok true)
    )
)


;; @desc Finalizes the battle, distributes the pool, and takes a fee.
;; NOTE: This function should only be called by the Leaderboard contract or a trusted oracle.
;; @param pool-id The ID of the pool to settle.
;; @param winning-coin-principal The principal who bet on the winning coin.
(define-public (process-payout (pool-id uint) (winning-coin-principal principal))
    (let
        (
        (pool (unwrap! (map-get? bet-pools pool-id) ERR-BATTLE-ENDED))
        (total-wager (+ (get coin-a-amount pool) (get coin-b-amount pool)))
        (fee (calculate-fee total-wager))
        (payout (- total-wager fee))
        )

        ;; Only the Leaderboard contract can call this function to finalize results
        (asserts! (is-eq tx-sender LEADERBOARD-CONTRACT) ERR-UNAUTHORIZED)

        ;; 1. Update pool status to mark the winner and prevent double payout
        (map-set bet-pools pool-id
        (merge pool
            { winner-principal: (some winning-coin-principal) }
        )
        )

        ;; 2. Pay out the winner (total pool - fee)
        (try! (as-contract (stx-transfer? payout (as-contract tx-sender) winning-coin-principal)))

        ;; 3. Send fee to treasury
        (try! (as-contract (stx-transfer? fee (as-contract tx-sender) PROTOCOL-TREASURY)))

        (ok winning-coin-principal)
    )
)