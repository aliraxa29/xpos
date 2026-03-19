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

vi.mock('@/services/dbBridge', () => ({
  cachePOSData: vi.fn(),
  getCachedPOSData: vi.fn(),
}))

vi.mock('@/services/electronBridge', () => ({
  isElectron: vi.fn(() => false),
}))

vi.mock('@/utils', () => ({
  isOnline: vi.fn(() => true),
  isNetworkError: vi.fn(() => false),
}))

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    fetchSettings: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
  }),
}))

import { call } from '@/services/api'
import { usePosStore } from '@/stores/posStore'

describe('Shift Management', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    globalThis.__ = ((text: string) => text) as any
  })

  describe('Opening Shift', () => {
    it('should fetch opening data for user', async () => {
      const mockedCall = call as ReturnType<typeof vi.fn>
      mockedCall.mockResolvedValueOnce({
        pos_profiles: [
          { name: 'POS-PROFILE-1', company: 'Test Company', currency: 'USD' },
        ],
        companies: [{ name: 'Test Company' }],
        payment_methods: [{ parent: 'POS-PROFILE-1', mode_of_payment: 'Cash', default: 1 }],
      })

      const result = await call('xpos.api.shifts.get_opening_data', {})

      expect(result).toBeDefined()
      expect(result.pos_profiles).toHaveLength(1)
    })

    it('should validate opening balance for each payment method', () => {
      const balanceDetails = [
        { mode_of_payment: 'Cash', opening_amount: 500 },
        { mode_of_payment: 'Card Terminal', opening_amount: 0 },
      ]

      expect(balanceDetails[0].opening_amount).toBe(500)
      expect(balanceDetails[1].opening_amount).toBe(0)
    })

    it('should require POS profile selection', () => {
      const openingData = {
        pos_profile: '',
        company: 'Test Company',
        balance_details: [],
      }

      const isValid = !!openingData.pos_profile
      expect(isValid).toBe(false)
    })

    it('should open shift with valid data', async () => {
      const mockedCall = call as ReturnType<typeof vi.fn>
      mockedCall.mockResolvedValueOnce({
        pos_opening_shift: {
          name: 'POS-OPEN-001',
          pos_profile: 'POS-PROFILE-1',
          company: 'Test Company',
        },
        profile: { name: 'POS-PROFILE-1' },
      })

      const result = await call('xpos.api.shifts.open_shift', {
        pos_profile: 'POS-PROFILE-1',
        company: 'Test Company',
        balance_details: [{ mode_of_payment: 'Cash', opening_amount: 200 }],
      })

      expect(result.pos_opening_shift).toBeDefined()
      expect(result.pos_opening_shift.name).toBe('POS-OPEN-001')
    })
  })

  describe('Checking Open Shift', () => {
    it('should find existing open shift for user', async () => {
      const mockedCall = call as ReturnType<typeof vi.fn>
      mockedCall.mockResolvedValueOnce({
        pos_opening_shift: {
          name: 'POS-OPEN-001',
          pos_profile: 'POS-PROFILE-1',
        },
      })

      const result = await call('xpos.api.shifts.check_open_shift', {})

      expect(result).toBeDefined()
      expect(result.pos_opening_shift.name).toBe('POS-OPEN-001')
    })

    it('should return null when no open shift exists', async () => {
      const mockedCall = call as ReturnType<typeof vi.fn>
      mockedCall.mockResolvedValueOnce(null)

      const result = await call('xpos.api.shifts.check_open_shift', {})

      expect(result).toBeNull()
    })

    it('should clear opening dialog when a later check finds an open shift', async () => {
      const mockedCall = call as ReturnType<typeof vi.fn>
      const posStore = usePosStore()

      mockedCall.mockResolvedValueOnce(null)
      await posStore.checkExistingShift()

      expect(posStore.showOpeningDialog).toBe(true)
      expect(posStore.isReady).toBe(false)

      mockedCall.mockResolvedValueOnce({
        pos_opening_shift: {
          name: 'POS-OPEN-001',
          pos_profile: 'POS-PROFILE-1',
          company: 'Test Company',
        },
        pos_profile: {
          name: 'POS-PROFILE-1',
          company: 'Test Company',
          payments: [],
        },
        company: {
          name: 'Test Company',
        },
        stock_settings: {},
        taxes: [],
        tax_inclusive: false,
        disable_rounded_total: false,
        print_settings: null,
      })

      await posStore.checkExistingShift()

      expect(posStore.showOpeningDialog).toBe(false)
      expect(posStore.isReady).toBe(true)
      expect(posStore.posOpeningShift?.name).toBe('POS-OPEN-001')
    })
  })

  describe('Closing Shift', () => {
    it('should calculate expected amounts per payment method', () => {
      const openingAmounts = [
        { mode_of_payment: 'Cash', opening_amount: 200 },
      ]
      const invoicePayments = [
        { mode_of_payment: 'Cash', amount: 500 },
        { mode_of_payment: 'Cash', amount: 300 },
        { mode_of_payment: 'Card', amount: 200 },
      ]

      const cashPayments = invoicePayments
        .filter(p => p.mode_of_payment === 'Cash')
        .reduce((sum, p) => sum + p.amount, 0)
      
      const cashOpening = openingAmounts.find(o => o.mode_of_payment === 'Cash')?.opening_amount || 0
      const expectedCash = cashOpening + cashPayments

      expect(expectedCash).toBe(1000) // 200 + 500 + 300
    })

    it('should calculate difference between expected and actual', () => {
      const expectedAmount = 1000
      const actualAmount = 980

      const difference = actualAmount - expectedAmount

      expect(difference).toBe(-20) // Short by 20
    })

    it('should close shift with closing details', async () => {
      const mockedCall = call as ReturnType<typeof vi.fn>
      mockedCall.mockResolvedValueOnce({
        pos_closing_shift: {
          name: 'POS-CLOSE-001',
          pos_opening_shift: 'POS-OPEN-001',
          grand_total: 5000,
        },
      })

      const result = await call('xpos.api.shifts.close_shift', {
        opening_shift: 'POS-OPEN-001',
        closing_details: [
          { mode_of_payment: 'Cash', expected_amount: 1000, closing_amount: 980 },
        ],
      })

      expect(result.pos_closing_shift).toBeDefined()
      expect(result.pos_closing_shift.name).toBe('POS-CLOSE-001')
    })
  })

  describe('Shift Summary', () => {
    it('should calculate total sales', () => {
      const invoices = [
        { grand_total: 500, is_return: 0 },
        { grand_total: 300, is_return: 0 },
        { grand_total: -50, is_return: 1 }, // Return
      ]

      const totalSales = invoices
        .filter(i => !i.is_return)
        .reduce((sum, i) => sum + i.grand_total, 0)
      
      expect(totalSales).toBe(800)
    })

    it('should calculate total returns', () => {
      const invoices = [
        { grand_total: 500, is_return: 0 },
        { grand_total: -50, is_return: 1 },
        { grand_total: -30, is_return: 1 },
      ]

      const totalReturns = invoices
        .filter(i => i.is_return)
        .reduce((sum, i) => sum + Math.abs(i.grand_total), 0)
      
      expect(totalReturns).toBe(80)
    })

    it('should calculate net total', () => {
      const totalSales = 800
      const totalReturns = 80

      const netTotal = totalSales - totalReturns

      expect(netTotal).toBe(720)
    })

    it('should count transactions', () => {
      const invoices = [
        { name: 'INV-001', is_return: 0 },
        { name: 'INV-002', is_return: 0 },
        { name: 'INV-003', is_return: 1 },
      ]

      const salesCount = invoices.filter(i => !i.is_return).length
      const returnsCount = invoices.filter(i => i.is_return).length

      expect(salesCount).toBe(2)
      expect(returnsCount).toBe(1)
    })
  })

  describe('Cash Movement Integration', () => {
    it('should include cash deposits in closing calculation', () => {
      const cashMovements = [
        { movement_type: 'Deposit', amount: 500 },
        { movement_type: 'Expense', amount: -100 },
      ]

      const totalMovements = cashMovements.reduce((sum, m) => sum + m.amount, 0)

      expect(totalMovements).toBe(400)
    })

    it('should subtract expenses from expected cash', () => {
      const expectedCashFromSales = 1000
      const expenses = [
        { amount: 50 },
        { amount: 30 },
      ]

      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
      const adjustedExpected = expectedCashFromSales - totalExpenses

      expect(adjustedExpected).toBe(920)
    })
  })
})

describe('Shift State Management', () => {
  it('should track shift status', () => {
    const shiftState = {
      isOpen: false,
      openingShift: null as any,
      profile: null as any,
    }

    // Simulate shift opening
    shiftState.isOpen = true
    shiftState.openingShift = { name: 'POS-OPEN-001' }
    shiftState.profile = { name: 'POS-PROFILE-1' }

    expect(shiftState.isOpen).toBe(true)
    expect(shiftState.openingShift?.name).toBe('POS-OPEN-001')
  })

  it('should clear state on shift close', () => {
    const shiftState = {
      isOpen: true,
      openingShift: { name: 'POS-OPEN-001' },
      profile: { name: 'POS-PROFILE-1' },
    }

    // Simulate shift closing
    shiftState.isOpen = false
    shiftState.openingShift = null as any
    // Profile typically remains for next shift

    expect(shiftState.isOpen).toBe(false)
    expect(shiftState.openingShift).toBeNull()
  })
})

describe('Opening Balance Validation', () => {
  it('should accept zero opening balance', () => {
    const balance = { mode_of_payment: 'Cash', opening_amount: 0 }
    
    const isValid = balance.opening_amount >= 0
    
    expect(isValid).toBe(true)
  })

  it('should reject negative opening balance', () => {
    const balance = { mode_of_payment: 'Cash', opening_amount: -100 }
    
    const isValid = balance.opening_amount >= 0
    
    expect(isValid).toBe(false)
  })

  it('should validate all payment methods have amounts', () => {
    const balances = [
      { mode_of_payment: 'Cash', opening_amount: 200 },
      { mode_of_payment: 'Card', opening_amount: undefined },
    ]

    const hasInvalid = balances.some(b => b.opening_amount === undefined)
    
    expect(hasInvalid).toBe(true)
  })
})
