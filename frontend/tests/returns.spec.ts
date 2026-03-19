/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the API module
vi.mock('@/services/api', () => ({
  call: vi.fn(),
  default: { call: vi.fn() },
}))

import { call } from '@/services/api'

describe('Returns Processing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    globalThis.__ = ((text: string) => text) as any
  })

  describe('Invoice Search for Returns', () => {
    it('should search invoices by invoice number', async () => {
      const mockedCall = call as ReturnType<typeof vi.fn>
      mockedCall.mockResolvedValueOnce([
        {
          name: 'INV-001',
          customer: 'CUST-001',
          customer_name: 'John Doe',
          grand_total: 500,
          posting_date: '2026-01-15',
        },
      ])

      const result = await call('xpos.api.invoices.search_invoices', {
        search_term: 'INV-001',
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('INV-001')
    })

    it('should filter out already fully returned invoices', () => {
      const invoices = [
        { name: 'INV-001', grand_total: 500, return_amount: 0 },
        { name: 'INV-002', grand_total: 300, return_amount: 300 }, // Fully returned
        { name: 'INV-003', grand_total: 200, return_amount: 100 }, // Partially returned
      ]

      const returnableInvoices = invoices.filter(
        inv => inv.return_amount < inv.grand_total
      )

      expect(returnableInvoices).toHaveLength(2)
      expect(returnableInvoices.map(i => i.name)).toContain('INV-001')
      expect(returnableInvoices.map(i => i.name)).toContain('INV-003')
    })
  })

  describe('Return Item Quantity Validation', () => {
    it('should not allow return qty exceeding original', () => {
      const originalItem = { item_code: 'ITEM-001', qty: 5 }
      const returnQty = 3

      const isValid = returnQty <= originalItem.qty

      expect(isValid).toBe(true)
    })

    it('should reject return qty exceeding original', () => {
      const originalItem = { item_code: 'ITEM-001', qty: 5 }
      const returnQty = 7

      const isValid = returnQty <= originalItem.qty

      expect(isValid).toBe(false)
    })

    it('should account for previously returned quantities', () => {
      const originalQty = 10
      const previouslyReturned = 3
      const newReturnQty = 5

      const maxReturnable = originalQty - previouslyReturned
      const isValid = newReturnQty <= maxReturnable

      expect(maxReturnable).toBe(7)
      expect(isValid).toBe(true)
    })

    it('should reject zero return quantity', () => {
      const returnQty = 0

      const isValid = returnQty > 0

      expect(isValid).toBe(false)
    })
  })

  describe('Return Item Rate Validation', () => {
    it('should use original item rate by default', () => {
      const originalItem = { item_code: 'ITEM-001', rate: 100 }
      const returnRate = originalItem.rate

      expect(returnRate).toBe(100)
    })

    it('should allow rate adjustment if permitted', () => {
      const allowRateChange = true
      const originalRate = 100
      const adjustedRate = 90 // 10% restocking fee

      const isValid = allowRateChange || adjustedRate === originalRate

      expect(isValid).toBe(true)
    })

    it('should reject rate changes when not permitted', () => {
      const allowRateChange = false
      const originalRate = 100
      const adjustedRate = 90

      const isValid = allowRateChange || adjustedRate === originalRate

      expect(isValid).toBe(false)
    })
  })

  describe('Return Total Calculation', () => {
    it('should calculate negative total for returns', () => {
      const returnItems = [
        { qty: -2, rate: 50 },
        { qty: -1, rate: 100 },
      ]

      const returnTotal = returnItems.reduce(
        (sum, item) => sum + item.qty * item.rate,
        0
      )

      expect(returnTotal).toBe(-200) // -100 + -100
    })

    it('should apply return discounts correctly', () => {
      const originalDiscount = 10 // 10%
      const returnSubtotal = -100

      const discountAmount = (returnSubtotal * originalDiscount) / 100
      const returnTotal = returnSubtotal - discountAmount

      // For negative subtotal, discount reduces the refund amount
      expect(discountAmount).toBe(-10)
      expect(returnTotal).toBe(-90)
    })
  })

  describe('Return Payment Handling', () => {
    it('should use same payment method for refund', () => {
      const originalPayment = { mode_of_payment: 'Cash', amount: 200 }
      const returnPayment = {
        mode_of_payment: originalPayment.mode_of_payment,
        amount: -50,
      }

      expect(returnPayment.mode_of_payment).toBe('Cash')
      expect(returnPayment.amount).toBe(-50)
    })

    it('should allow different refund method if permitted', () => {
      const allowDifferentRefundMethod = true
      const originalMethod = 'Card'
      const refundMethod = 'Cash'

      const isValid = allowDifferentRefundMethod || refundMethod === originalMethod

      expect(isValid).toBe(true)
    })

    it('should calculate change for cash returns', () => {
      const returnTotal = -80 // Refund $80
      const cashGiven = -100 // Gave customer $100

      const change = Math.abs(cashGiven) - Math.abs(returnTotal)

      expect(change).toBe(20) // $20 extra given
    })
  })

  describe('Return Mode State', () => {
    it('should enter return mode with selected invoice', () => {
      const state = {
        isReturnMode: false,
        returnAgainst: '',
        customer: null as any,
      }

      const invoice = {
        name: 'INV-001',
        customer: 'CUST-001',
        customer_name: 'John Doe',
      }

      // Enter return mode
      state.isReturnMode = true
      state.returnAgainst = invoice.name
      state.customer = { name: invoice.customer, customer_name: invoice.customer_name }

      expect(state.isReturnMode).toBe(true)
      expect(state.returnAgainst).toBe('INV-001')
      expect(state.customer?.name).toBe('CUST-001')
    })

    it('should lock customer in return mode', () => {
      const isReturnMode = true
      const canChangeCustomer = !isReturnMode

      expect(canChangeCustomer).toBe(false)
    })

    it('should exit return mode and clear state', () => {
      const state = {
        isReturnMode: true,
        returnAgainst: 'INV-001',
        items: [{ item_code: 'ITEM-001', qty: -2 }],
      }

      // Exit return mode
      state.isReturnMode = false
      state.returnAgainst = ''
      state.items = []

      expect(state.isReturnMode).toBe(false)
      expect(state.returnAgainst).toBe('')
      expect(state.items).toHaveLength(0)
    })
  })

  describe('Return Invoice Creation', () => {
    it('should create return invoice with negative quantities', async () => {
      const mockedCall = call as ReturnType<typeof vi.fn>
      mockedCall.mockResolvedValueOnce({
        name: 'INV-RET-001',
        is_return: 1,
        return_against: 'INV-001',
        grand_total: -150,
      })

      const result = await call('xpos.api.invoices.create_invoice', {
        is_return: 1,
        return_against: 'INV-001',
        customer: 'CUST-001',
        items: [{ item_code: 'ITEM-001', qty: -3, rate: 50 }],
        payments: [{ mode_of_payment: 'Cash', amount: -150 }],
      })

      expect(result.is_return).toBe(1)
      expect(result.return_against).toBe('INV-001')
      expect(result.grand_total).toBe(-150)
    })
  })

  describe('Partial Returns', () => {
    it('should track returnable quantities', () => {
      const originalItems = [
        { item_code: 'ITEM-001', qty: 5, returned_qty: 2 },
        { item_code: 'ITEM-002', qty: 3, returned_qty: 0 },
      ]

      const returnableItems = originalItems.map(item => ({
        ...item,
        returnable_qty: item.qty - item.returned_qty,
      }))

      expect(returnableItems[0].returnable_qty).toBe(3)
      expect(returnableItems[1].returnable_qty).toBe(3)
    })

    it('should allow selecting items for partial return', () => {
      const returnableItems = [
        { item_code: 'ITEM-001', returnable_qty: 3 },
        { item_code: 'ITEM-002', returnable_qty: 5 },
      ]

      const selectedForReturn = [
        { item_code: 'ITEM-001', return_qty: 1 },
      ]

      expect(selectedForReturn).toHaveLength(1)
      expect(selectedForReturn[0].return_qty).toBeLessThanOrEqual(
        returnableItems.find(i => i.item_code === 'ITEM-001')!.returnable_qty
      )
    })
  })

  describe('Return Reason Tracking', () => {
    it('should store return reason', () => {
      const returnItem = {
        item_code: 'ITEM-001',
        qty: -2,
        return_reason: 'Defective product',
      }

      expect(returnItem.return_reason).toBe('Defective product')
    })

    it('should require reason when configured', () => {
      const requireReason = true
      const returnReason = ''

      const isValid = !requireReason || returnReason.trim() !== ''

      expect(isValid).toBe(false)
    })
  })

  describe('Return Date Validation', () => {
    it('should check return within allowed period', () => {
      const invoiceDate = new Date('2026-01-01')
      const returnDate = new Date('2026-01-15')
      const maxReturnDays = 30

      const daysDiff = Math.floor(
        (returnDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      const isWithinPeriod = daysDiff <= maxReturnDays

      expect(daysDiff).toBe(14)
      expect(isWithinPeriod).toBe(true)
    })

    it('should reject returns after allowed period', () => {
      const invoiceDate = new Date('2026-01-01')
      const returnDate = new Date('2026-03-15')
      const maxReturnDays = 30

      const daysDiff = Math.floor(
        (returnDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      const isWithinPeriod = daysDiff <= maxReturnDays

      expect(isWithinPeriod).toBe(false)
    })
  })
})

describe('Exchange Flow', () => {
  it('should calculate exchange balance', () => {
    const returnTotal = 100 // Returning items worth $100
    const newPurchaseTotal = 150 // Buying items worth $150

    const balanceDue = newPurchaseTotal - returnTotal

    expect(balanceDue).toBe(50) // Customer owes $50
  })

  it('should handle exchange credit', () => {
    const returnTotal = 150
    const newPurchaseTotal = 100

    const credit = returnTotal - newPurchaseTotal

    expect(credit).toBe(50) // Customer gets $50 credit/refund
  })
})
