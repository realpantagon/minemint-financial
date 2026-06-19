import { useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  ArrowLeftRight,
  X,
  Award,
  Wallet,
  Sparkles,
  ChevronLeft
} from 'lucide-react';
import './App.css';
import type { Account, Transaction, MonthlySalaryLog, SalaryAllocationDetail } from './types';
import {
  fetchAccounts,
  fetchTransactions,
  fetchSalaryLogs,
  createTransaction,
  updateAccountBalance,
  updateAccountDetails,
  createSalaryLog,
} from './lib/api';

// Helper to format currency
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
};

// Current Month string: YYYY-MM
const getCurrentMonthString = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
};

function App() {
  // --- Supabase-backed data ---
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salaryLogs, setSalaryLogs] = useState<MonthlySalaryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions'>('accounts');
  
  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalMode, setTxModalMode] = useState<'income' | 'expense' | 'transfer'>('income');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoggingSalaryViewActive, setIsLoggingSalaryViewActive] = useState(false);
  const [isSalaryHistoryOpen, setIsSalaryHistoryOpen] = useState(false);
  const [isSalaryMenuOpen, setIsSalaryMenuOpen] = useState(false);
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState(0);
  const [historyViewMode, setHistoryViewMode] = useState<'all' | 'single'>('all');

  const [txAccountId, setTxAccountId] = useState('');
  const [txTargetAccountId, setTxTargetAccountId] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Salary log input
  const [salaryInput, setSalaryInput] = useState('');
  
  interface SalaryAllocation {
    id: string;
    accountId: string;
    amount: string;
  }
  const [salaryAllocations, setSalaryAllocations] = useState<SalaryAllocation[]>([]);
  const [salaryMonth, setSalaryMonth] = useState(getCurrentMonthString());
  const [isSalaryReviewOpen, setIsSalaryReviewOpen] = useState(false);

  // Edit Account states
  const [isEditAccModalOpen, setIsEditAccModalOpen] = useState(false);
  const [editAccId, setEditAccId] = useState('');
  const [editAccName, setEditAccName] = useState('');
  const [editAccPurpose, setEditAccPurpose] = useState('');
  const [editAccGoal, setEditAccGoal] = useState('');
  const [editAccBank, setEditAccBank] = useState('');
  const [editAccColor, setEditAccColor] = useState('');

  // Custom Alert states
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<React.ReactNode>('');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertType, setAlertType] = useState<'alert' | 'confirm'>('alert');
  const [alertCallback, setAlertCallback] = useState<{ fn: (() => void) } | null>(null);

  const triggerAlert = (message: React.ReactNode, callback?: () => void, title: string = 'แจ้งเตือน') => {
    setAlertMessage(message);
    setAlertTitle(title);
    setAlertType('alert');
    setAlertCallback(callback ? { fn: callback } : null);
    setAlertOpen(true);
  };

  const triggerConfirm = (message: React.ReactNode, callback: () => void, title: string = 'ยืนยัน') => {
    setAlertMessage(message);
    setAlertTitle(title);
    setAlertType('confirm');
    setAlertCallback({ fn: callback });
    setAlertOpen(true);
  };

  const handleAlertConfirm = () => {
    setAlertOpen(false);
    if (alertCallback && alertCallback.fn) {
      alertCallback.fn();
    }
  };

  const handleAlertCancel = () => {
    setAlertOpen(false);
  };

  // Load all data from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accs, txs, logs] = await Promise.all([
          fetchAccounts(),
          fetchTransactions(),
          fetchSalaryLogs(),
        ]);
        if (cancelled) return;
        setAccounts(accs);
        setTransactions(txs);
        setSalaryLogs(logs);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-populate salary allocations with all accounts when salary input is entered
  useEffect(() => {
    const totalSalaryVal = parseFloat(salaryInput) || 0;
    if (totalSalaryVal <= 0) {
      setSalaryAllocations([]);
    } else if (salaryAllocations.length === 0 && salaryInput !== '') {
      const initial = accounts.map(acc => ({
        id: acc.id + '-' + Math.random(),
        accountId: acc.id,
        amount: ''
      }));
      setSalaryAllocations(initial);
    }
  }, [salaryInput, accounts]);

  // --- Calculations ---
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalGoal = accounts.reduce((sum, acc) => sum + acc.goal, 0);
  const overallPercentage = totalGoal > 0 ? Math.min(Math.round((totalBalance / totalGoal) * 100), 100) : 0;

  // Pie chart calculation using white shades
  let chartAccumulated = 0;
  const chartSlices = accounts.map((acc, index) => {
    const percent = totalBalance > 0 ? (acc.balance / totalBalance) : 0;
    const opacities = [0.95, 0.7, 0.45, 0.2];
    const opacity = opacities[index % opacities.length];
    const color = `rgba(255, 255, 255, ${opacity})`;
    const start = chartAccumulated * 100;
    chartAccumulated += percent;
    const end = chartAccumulated * 100;
    return { color, start, end };
  });
  const conicGradientString = totalBalance > 0
    ? chartSlices.map(slice => {
        if (chartSlices.length <= 1) {
          return `${slice.color} ${slice.start}% ${slice.end}%`;
        }
        const gap = 1.5;
        const sliceEnd = Math.max(slice.start, slice.end - gap);
        return `${slice.color} ${slice.start}% ${sliceEnd}%, transparent ${sliceEnd}% ${slice.end}%`;
      }).join(', ')
    : 'rgba(255, 255, 255, 0.2) 0% 100%';

  const totalSalary = parseFloat(salaryInput) || 0;
  const totalAllocated = salaryAllocations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const remainingSalary = totalSalary - totalAllocated;

  // --- Operations ---


  const updateSalaryAllocation = (id: string, field: 'accountId' | 'amount', value: string) => {
    setSalaryAllocations(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeSalaryAllocation = (id: string) => {
    setSalaryAllocations(prev => prev.filter(item => item.id !== id));
  };
  const openTxModal = (mode: 'income' | 'expense' | 'transfer', accId: string = '') => {
    setTxModalMode(mode);
    setTxAccountId(accId || (accounts.length > 0 ? accounts[0].id : ''));
    if (accounts.length > 1) {
      const otherAcc = accounts.find(a => a.id !== accId);
      setTxTargetAccountId(otherAcc ? otherAcc.id : '');
    }
    setTxAmount('');
    setTxDesc('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setIsTxModalOpen(true);
  };

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(txAmount);
    if (!amountVal || amountVal <= 0 || !txAccountId) return;

    const accSource = accounts.find(a => a.id === txAccountId);
    if (!accSource) return;

    if (txModalMode === 'transfer') {
      if (!txTargetAccountId || txAccountId === txTargetAccountId) {
        triggerAlert('กรุณาเลือกบัญชีปลายทางที่ต่างจากบัญชีต้นทาง');
        return;
      }
    }

    let confirmContent: React.ReactNode = null;
    if (txModalMode === 'income') {
      const targetBalance = accSource.balance + amountVal;
      confirmContent = (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '13px', color: 'var(--kitty-text-light)', marginBottom: '10px' }}>กรุณาตรวจสอบและยืนยันข้อมูลรายการ:</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>ประเภทรายการ</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: 'var(--kitty-blue)', textAlign: 'right' }}>ฝากเงิน</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>บัญชี</td>
                <td style={{ padding: '8px 0', fontWeight: 700, textAlign: 'right' }}>{accSource.name}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>จำนวนเงิน</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: 'var(--kitty-blue)', textAlign: 'right' }}>+{formatMoney(amountVal)}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>ยอดหลังฝาก</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: 'var(--kitty-text)', textAlign: 'right' }}>{formatMoney(targetBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    } else if (txModalMode === 'expense') {
      const targetBalance = accSource.balance - amountVal;
      confirmContent = (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '13px', color: 'var(--kitty-text-light)', marginBottom: '10px' }}>กรุณาตรวจสอบและยืนยันข้อมูลรายการ:</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>ประเภทรายการ</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: 'var(--kitty-red)', textAlign: 'right' }}>ถอนเงิน</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>บัญชี</td>
                <td style={{ padding: '8px 0', fontWeight: 700, textAlign: 'right' }}>{accSource.name}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>จำนวนเงิน</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: 'var(--kitty-red)', textAlign: 'right' }}>-{formatMoney(amountVal)}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>ยอดคงเหลือ</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: 'var(--kitty-text)', textAlign: 'right' }}>{formatMoney(targetBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    } else if (txModalMode === 'transfer') {
      const accTarget = accounts.find(a => a.id === txTargetAccountId);
      if (!accTarget) return;
      const sourceTargetBalance = accSource.balance - amountVal;
      const targetTargetBalance = accTarget.balance + amountVal;
      confirmContent = (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '13px', color: 'var(--kitty-text-light)', marginBottom: '10px' }}>กรุณาตรวจสอบและยืนยันข้อมูลรายการ:</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>ประเภทรายการ</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: '#B28200', textAlign: 'right' }}>โอนเงิน</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>จากบัญชี (ต้นทาง)</td>
                <td style={{ padding: '8px 0', fontWeight: 700, textAlign: 'right' }}>{accSource.name}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>ไปยังบัญชี (ปลายทาง)</td>
                <td style={{ padding: '8px 0', fontWeight: 700, textAlign: 'right' }}>{accTarget.name}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>จำนวนเงินโอน</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: '#B28200', textAlign: 'right' }}>{formatMoney(amountVal)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--kitty-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>ยอดหลังโอน (ต้นทาง)</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: 'var(--kitty-red)', textAlign: 'right' }}>{formatMoney(sourceTargetBalance)}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: 'var(--kitty-text-light)' }}>ยอดหลังโอน (ปลายทาง)</td>
                <td style={{ padding: '8px 0', fontWeight: 700, color: '#27AE60', textAlign: 'right' }}>{formatMoney(targetTargetBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    triggerConfirm(confirmContent, async () => {
      try {
        const accTarget = txModalMode === 'transfer'
          ? accounts.find(a => a.id === txTargetAccountId)
          : undefined;
        if (txModalMode === 'transfer' && !accTarget) return;

        const sourceNewBalance = txModalMode === 'income'
          ? accSource.balance + amountVal
          : accSource.balance - amountVal;
        const targetNewBalance = accTarget ? accTarget.balance + amountVal : undefined;

        const newTx = await createTransaction({
          accountId: txAccountId,
          targetAccountId: txModalMode === 'transfer' ? txTargetAccountId : undefined,
          amount: amountVal,
          type: txModalMode,
          description: txDesc.trim() || (txModalMode === 'income' ? 'รายรับ' : txModalMode === 'expense' ? 'รายจ่าย' : 'โอนเงิน'),
          date: txDate
        });

        await Promise.all([
          updateAccountBalance(accSource.id, sourceNewBalance),
          ...(accTarget ? [updateAccountBalance(accTarget.id, targetNewBalance!)] : []),
        ]);

        setAccounts(prev => prev.map(acc => {
          if (acc.id === accSource.id) return { ...acc, balance: sourceNewBalance };
          if (accTarget && acc.id === accTarget.id) return { ...acc, balance: targetNewBalance! };
          return acc;
        }));
        setTransactions(prev => [newTx, ...prev]);
        setIsTxModalOpen(false);

        setTimeout(() => {
          triggerAlert('ทำรายการเสร็จสิ้นเรียบร้อยแล้ว', undefined, 'สำเร็จ');
        }, 100);
      } catch {
        triggerAlert('เกิดข้อผิดพลาด ไม่สามารถบันทึกรายการได้ กรุณาลองใหม่อีกครั้ง');
      }
    }, 'ยืนยันการทำรายการ');
  };

  const openEditAccountModal = (acc: Account) => {
    setEditAccId(acc.id);
    setEditAccName(acc.name);
    setEditAccPurpose(acc.purpose || '');
    setEditAccGoal(acc.goal > 0 ? acc.goal.toString() : '');
    setEditAccBank(acc.bank || '');
    setEditAccColor(acc.color || '#0A66C2');
    setIsEditAccModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccName.trim()) {
      triggerAlert('กรุณากรอกชื่อบัญชี');
      return;
    }

    try {
      const updated = await updateAccountDetails(editAccId, {
        name: editAccName.trim(),
        purpose: editAccPurpose.trim(),
        goal: parseFloat(editAccGoal) || 0,
        bank: editAccBank.trim(),
        color: editAccColor
      });

      setAccounts(prev => prev.map(acc => (acc.id === editAccId ? updated : acc)));
      setIsEditAccModalOpen(false);
    } catch {
      triggerAlert('บันทึกข้อมูลบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleLogSalary = (e: React.FormEvent) => {
    e.preventDefault();
    const totalSalaryVal = parseFloat(salaryInput);
    if (!totalSalaryVal || totalSalaryVal <= 0) return;

    if (totalAllocated > totalSalaryVal) {
      triggerAlert('จำนวนเงินที่แบ่งเกินกว่ายอดเงินเดือนทั้งหมด');
      return;
    }

    if (remainingSalary !== 0) {
      triggerAlert('กรุณาแบ่งเงินเดือนให้ครบถ้วนก่อนบันทึก');
      return;
    }

    // Open review modal
    setIsSalaryReviewOpen(true);
  };

  const confirmAndSaveSalary = async () => {
    const totalSalaryVal = parseFloat(salaryInput);
    if (!totalSalaryVal || totalSalaryVal <= 0) return;

    try {
      const allocationsToApply = salaryAllocations
        .map(alloc => ({ accountId: alloc.accountId, amount: parseFloat(alloc.amount) || 0 }))
        .filter(alloc => alloc.amount > 0);

      const balanceUpdates = allocationsToApply.map(alloc => {
        const acc = accounts.find(a => a.id === alloc.accountId);
        return { accountId: alloc.accountId, newBalance: (acc?.balance ?? 0) + alloc.amount };
      });

      const newTxs = await Promise.all(
        allocationsToApply.map(alloc =>
          createTransaction({
            accountId: alloc.accountId,
            amount: alloc.amount,
            type: 'income',
            description: `เงินเดือนประจำเดือน ${salaryMonth}`,
            date: new Date().toISOString().split('T')[0]
          })
        )
      );

      await Promise.all(balanceUpdates.map(u => updateAccountBalance(u.accountId, u.newBalance)));

      setAccounts(prev => prev.map(acc => {
        const update = balanceUpdates.find(u => u.accountId === acc.id);
        return update ? { ...acc, balance: update.newBalance } : acc;
      }));
      if (newTxs.length > 0) {
        setTransactions(prev => [...newTxs, ...prev]);
      }

      const details: SalaryAllocationDetail[] = allocationsToApply.map(alloc => ({
        accountId: alloc.accountId,
        accountName: accounts.find(a => a.id === alloc.accountId)?.name || 'บัญชี',
        amount: alloc.amount
      }));

      const newLog = await createSalaryLog({
        month: salaryMonth,
        amount: totalSalaryVal,
        isLogged: true,
        date: new Date().toISOString().split('T')[0],
        allocations: details
      });

      setSalaryLogs(prev => [newLog, ...prev]);
      setSalaryInput('');
      setSalaryAllocations([]);
      setIsLoggingSalaryViewActive(false);
      setIsSalaryReviewOpen(false);
      triggerAlert(`บันทึกเงินเดือนประจำเดือน ${salaryMonth} สำเร็จแล้ว`);
    } catch {
      triggerAlert('บันทึกเงินเดือนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleDuplicateLog = (log: MonthlySalaryLog) => {
    if (!log.allocations || log.allocations.length === 0) {
      triggerAlert('ไม่พบข้อมูลการแบ่งเงินในเดือนนี้เพื่อคัดลอก');
      return;
    }

    const prefilled = log.allocations.map(alloc => ({
      id: Date.now().toString() + Math.random(),
      accountId: alloc.accountId,
      amount: alloc.amount.toString()
    }));

    setSalaryInput(log.amount.toString());
    setSalaryAllocations(prefilled);
    setSalaryMonth(getCurrentMonthString());
    setIsSalaryHistoryOpen(false);
    setIsLoggingSalaryViewActive(true);
  };

  const currentMonth = getCurrentMonthString();
  const isSalaryLoggedThisMonth = salaryLogs.some(log => log.month === currentMonth);

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          {/* <div className="brand-icon">
            <img src="/app-logo.png" alt="Minemint Finance" className="brand-logo" />
          </div> */}
        <div className="header-decoration" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/Hello-Kitty-Logo.png" alt="Hello Kitty Decoration" style={{ height: '22px', objectFit: 'contain' }} />
        </div>
          <div className="brand-title">
            Minemint Finance
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="empty-state">
          <div className="empty-kitty">⏳</div>
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      ) : loadError ? (
        <div className="empty-state">
          <div className="empty-kitty">⚠️</div>
          <p>{loadError}</p>
        </div>
      ) : selectedAccountId ? (
        // Account Detail View (Full Page)
        (() => {
          const acc = accounts.find(a => a.id === selectedAccountId);
          if (!acc) {
            setSelectedAccountId(null);
            return null;
          }
          const pct = acc.goal > 0 ? Math.min(Math.round((acc.balance / acc.goal) * 100), 100) : 0;
          
          // Filter transactions related to this account
          const accTxs = transactions.filter(t => t.accountId === acc.id || t.targetAccountId === acc.id);

          return (
            <div>
              <div className="section-title-bar" style={{ marginBottom: '16px' }}>
                <button 
                  className="cute-btn-sm" 
                  style={{ background: 'white', color: 'var(--kitty-text)', borderColor: 'var(--kitty-border)' }}
                  onClick={() => setSelectedAccountId(null)}
                >
                  <ChevronLeft size={16} /> ย้อนกลับ
                </button>
                <button 
                  className="cute-btn-sm" 
                  style={{ background: 'var(--kitty-yellow-light)', color: '#5C4300', borderColor: 'var(--kitty-yellow)' }}
                  onClick={() => openEditAccountModal(acc)}
                >
                  แก้ไขบัญชี
                </button>
              </div>

              {/* Large detail account card */}
              <div className="account-card" style={{ borderColor: 'var(--kitty-red-light)', borderWidth: '2px' }}>
                <div className="account-header">
                  <div className="account-meta">
                    <span className="account-name" style={{ fontSize: '14px' }}>{acc.name}</span>
                    {acc.bank && (
                      <span style={{ fontSize: '11px', color: 'var(--kitty-text-light)', marginTop: '2px', display: 'block' }}>
                        ธนาคาร: {acc.bank}
                      </span>
                    )}
                    {acc.purpose && (
                      <span style={{ fontSize: '11px', color: 'var(--kitty-text-light)', marginTop: '2px', display: 'block' }}>
                        จุดประสงค์: {acc.purpose}
                      </span>
                    )}
                    <span className="account-date">สร้างเมื่อ {new Date(acc.createdAt).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>

                <div className="account-balance-area" style={{ margin: '8px 0' }}>
                  <span className="account-val" style={{ fontSize: '20px' }}>{formatMoney(acc.balance)}</span>
                  {acc.goal > 0 && (
                    <span className="account-goal-val">
                      เป้าหมาย: {formatMoney(acc.goal)}
                    </span>
                  )}
                </div>

                {acc.goal > 0 && (
                  <div className="progress-container" style={{ marginBottom: '14px' }}>
                    <div className="progress-label-bar">
                      <span style={{ color: acc.color || 'var(--kitty-blue)', fontWeight: 600 }}>ความคืบหน้า</span>
                      <span style={{ color: acc.color || 'var(--kitty-blue)', fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div className="progress-track">
                      <div 
                        className="progress-fill"
                        style={{ width: `${pct}%`, background: acc.color || 'var(--kitty-blue)' }}
                      />
                    </div>
                  </div>
                )}

                {/* Operational buttons inside detail card */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px dashed var(--kitty-border)', paddingTop: '10px' }}>
                  <button className="btn-op plus" style={{ padding: '6px 8px' }} onClick={() => openTxModal('income', acc.id)}>
                    <Plus size={12} /> ฝากเงิน
                  </button>
                  <button className="btn-op minus" style={{ padding: '6px 8px' }} onClick={() => openTxModal('expense', acc.id)}>
                    <Minus size={12} /> ถอนเงิน
                  </button>
                  {accounts.length > 1 && (
                    <button className="btn-op" style={{ background: '#FDF7E7', color: '#B28200', padding: '6px 8px' }} onClick={() => openTxModal('transfer', acc.id)}>
                      <ArrowLeftRight size={12} /> โอนเงิน
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions for this account */}
              <h3 className="section-title" style={{ fontSize: '13px', marginBottom: '8px' }}>
                📝 ประวัติรายการของบัญชีนี้
              </h3>
              
              <div className="transaction-list">
                {accTxs.length === 0 ? (
                  <div className="empty-state">
                    <p>ยังไม่มีรายการทำธุรกรรมของบัญชีนี้ค่ะ</p>
                  </div>
                ) : (
                  accTxs.map(tx => {
                    const txAcc = accounts.find(a => a.id === tx.accountId);
                    const targetAcc = tx.targetAccountId ? accounts.find(a => a.id === tx.targetAccountId) : null;
                    
                    let displayType: 'income' | 'expense' | 'transfer' = tx.type;
                    if (tx.type === 'transfer') {
                      displayType = tx.accountId === acc.id ? 'expense' : 'income';
                    }

                    return (
                      <div className="transaction-item" key={tx.id}>
                        <div className="tx-info">
                          <div className={`tx-icon ${displayType}`}>
                            {displayType === 'income' && <Plus size={16} />}
                            {displayType === 'expense' && <Minus size={16} />}
                          </div>
                          <div className="tx-desc-area">
                            <span className="tx-desc">{tx.description}</span>
                            <span className="tx-account" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                              <span>
                                {tx.type === 'transfer'
                                  ? `โอน: ${txAcc?.name.split(' ')[0]} ➔ ${targetAcc?.name.split(' ')[0]}`
                                  : `ประเภท: ${tx.type === 'income' ? 'ฝาก' : 'ถอน'}`}
                              </span>
                              <span style={{ fontSize: '9px', color: 'var(--kitty-text-light)' }}>
                                วันที่: {tx.date}
                              </span>
                            </span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span className={`tx-amount ${displayType}`} style={{ whiteSpace: 'nowrap' }}>
                            {displayType === 'income' ? '+' : '-'}
                            {formatMoney(tx.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()
      ) : isLoggingSalaryViewActive ? (
        // Salary Logging View (Full Page)
        <div>
          <div className="section-title-bar" style={{ marginBottom: '12px' }}>
            <button 
              className="cute-btn-sm" 
              style={{ background: 'white', color: 'var(--kitty-text)', borderColor: 'var(--kitty-border)' }}
              onClick={() => {
                setIsLoggingSalaryViewActive(false);
                setSalaryInput('');
                setSalaryAllocations([]);
              }}
            >
              <ChevronLeft size={14} /> ย้อนกลับ
            </button>
            <h2 className="section-title" style={{ fontSize: '14px' }}>บันทึกเงินเดือน</h2>
          </div>

          <div className="salary-log-card" style={{ borderStyle: 'solid', borderWidth: '2px', background: 'var(--kitty-yellow-light)' }}>
            <h3 className="salary-title" style={{ fontSize: '13px', marginBottom: '10px' }}>
              <Sparkles size={18} fill="var(--kitty-yellow)" color="#B28200" />
              ระบุยอดเงินเดือนและเลือกบัญชีปลายทาง
            </h3>

            <form onSubmit={handleLogSalary} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: '#B28200' }}>จำนวนเงินเดือนทั้งหมด (บาท)</label>
                <div className="salary-input-wrapper" style={{ width: '100%' }}>
                  <input 
                    type="number" 
                    placeholder="ป้อนเงินเดือนทั้งหมด"
                    className="cute-input"
                    style={{ width: '100%', paddingRight: '40px', border: '1.5px solid var(--kitty-yellow)' }}
                    value={salaryInput}
                    onChange={e => setSalaryInput(e.target.value)}
                    required
                  />
                  <span className="salary-currency">บาท</span>
                </div>
              </div>

              {/* Dynamic allocation rows & helper info wrapper */}
              {totalSalary > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'white', padding: '10px', borderRadius: '12px', border: '1px solid var(--kitty-border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--kitty-text-light)', marginBottom: '3px' }}>
                    แบ่งลงบัญชี:
                  </div>
                  
                  {salaryAllocations.map(alloc => {
                    const selectedElsewhere = salaryAllocations
                      .filter(a => a.id !== alloc.id)
                      .map(a => a.accountId);
                    const availableAccounts = accounts.filter(acc => !selectedElsewhere.includes(acc.id));

                    return (
                      <div key={alloc.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select 
                          className="cute-select" 
                          style={{ flex: 1.2, padding: '6px 8px', fontSize: '12px' }}
                          value={alloc.accountId}
                          onChange={e => updateSalaryAllocation(alloc.id, 'accountId', e.target.value)}
                        >
                          {availableAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name.split(' ')[0]}</option>
                          ))}
                        </select>
                        
                        <input 
                          type="number" 
                          placeholder="จำนวนเงิน"
                          className="cute-input"
                          style={{ flex: 1, padding: '6px 8px', fontSize: '12px' }}
                          value={alloc.amount}
                          onChange={e => updateSalaryAllocation(alloc.id, 'amount', e.target.value)}
                          required
                        />
                        
                        <button 
                          type="button" 
                          className="btn-trash"
                          style={{ padding: '4px' }}
                          onClick={() => removeSalaryAllocation(alloc.id)}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Remaining amount summary */}
                  {salaryAllocations.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--kitty-border)', fontSize: '12px', fontWeight: 700 }}>
                      <span style={{ color: remainingSalary < 0 ? 'var(--kitty-red)' : 'var(--kitty-text-light)' }}>
                        {remainingSalary < 0 ? 'ยอดเงินเกิน!' : 'คงเหลือ:'}
                      </span>
                      <span style={{ color: remainingSalary < 0 ? 'var(--kitty-red)' : 'var(--kitty-blue)' }}>
                        {formatMoney(remainingSalary)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {totalSalary > 0 && remainingSalary === 0 && salaryAllocations.length > 0 && (
                <button 
                  type="submit" 
                  className="btn-submit" 
                  style={{ margin: 0, padding: '8px', background: 'var(--kitty-yellow)', color: '#5C4300' }}
                >
                  บันทึกข้อมูล
                </button>
              )}
            </form>
          </div>
        </div>
      ) : isSalaryHistoryOpen ? (
        // Salary History View (Full Page)
        (() => {
          const currentLog = salaryLogs[viewingHistoryIndex];
          
          const nextMonth = () => {
            if (viewingHistoryIndex > 0) {
              setViewingHistoryIndex(prev => prev - 1);
            }
          };
          
          const prevMonth = () => {
            if (viewingHistoryIndex < salaryLogs.length - 1) {
              setViewingHistoryIndex(prev => prev + 1);
            }
          };

          return (
            <div>
              <div className="section-title-bar" style={{ marginBottom: '12px' }}>
                <button 
                  className="cute-btn-sm" 
                  style={{ background: 'white', color: 'var(--kitty-text)', borderColor: 'var(--kitty-border)' }}
                  onClick={() => {
                    setIsSalaryHistoryOpen(false);
                    setIsSalaryMenuOpen(true);
                  }}
                >
                  <ChevronLeft size={14} /> ย้อนกลับ
                </button>
                <h2 className="section-title" style={{ fontSize: '14px' }}>ประวัติเงินเดือน</h2>
              </div>

              {salaryLogs.length === 0 ? (
                <div style={{ background: 'white', borderRadius: '16px', padding: '30px 15px', border: '2px solid var(--kitty-border)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--kitty-text-light)', fontWeight: 700 }}>ยังไม่มีประวัติบันทึกเงินเดือน</p>
                </div>
              ) : (
                <div>
                  {/* View Mode Switcher */}
                  <div style={{ display: 'flex', background: 'white', padding: '3px', borderRadius: '12px', border: '1px solid var(--kitty-border)', marginBottom: '12px', gap: '3px' }}>
                    <button 
                       type="button" 
                      className={`tab-btn ${historyViewMode === 'all' ? 'active' : ''}`}
                      style={{ padding: '6px 10px', fontSize: '12px', border: 'none' }}
                      onClick={() => setHistoryViewMode('all')}
                    >
                      แสดงทั้งหมด
                    </button>
                    <button 
                       type="button" 
                      className={`tab-btn ${historyViewMode === 'single' ? 'active' : ''}`}
                      style={{ padding: '6px 10px', fontSize: '12px', border: 'none' }}
                      onClick={() => setHistoryViewMode('single')}
                    >
                      ดูทีละเดือน
                    </button>
                  </div>

                  {historyViewMode === 'all' ? (
                    /* Stacked List of All Months View (Default) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {salaryLogs.map(log => (
                        <div key={log.id} style={{ background: 'var(--kitty-card-bg)', borderRadius: '16px', padding: '14px', border: '2px solid var(--kitty-border)', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '2px dashed var(--kitty-border)', paddingBottom: '8px' }}>
                            <span className="num-font" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--kitty-text)' }}>{log.month}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="num-font" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--kitty-blue)' }}>
                                {formatMoney(log.amount)}
                              </span>
                              {log.allocations && log.allocations.length > 0 && (
                                <button 
                                  type="button" 
                                  className="cute-btn-sm" 
                                  style={{ padding: '3px 6px', fontSize: '10px', background: 'var(--kitty-blue-light)', color: 'var(--kitty-blue)', borderColor: 'var(--kitty-blue-light)' }}
                                  onClick={() => handleDuplicateLog(log)}
                                  title="คัดลอกสำหรับเดือนนี้"
                                >
                                  คัดลอก
                                </button>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {log.allocations && log.allocations.length > 0 ? (
                              log.allocations.map((alloc, i) => {
                                const accColor = accounts.find(a => a.id === alloc.accountId)?.color || 'var(--kitty-blue)';
                                return (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--kitty-bg)', borderRadius: '8px', border: '1px solid var(--kitty-border)' }}>
                                    <span style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--kitty-text)' }}>{alloc.accountName}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span className="num-font" style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--kitty-text)' }}>
                                        {formatMoney(alloc.amount)}
                                      </span>
                                      <span 
                                        style={{
                                          display: 'inline-block',
                                          width: '10px',
                                          height: '10px',
                                          borderRadius: '50%',
                                          backgroundColor: accColor,
                                          boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ fontSize: '12px', color: 'var(--kitty-text-light)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                                ไม่มีข้อมูลแยกบัญชี
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Single Month View with arrow navigation */
                    <div>
                      {/* Month Navigation Control */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: '16px', padding: '8px 12px', border: '1.5px solid var(--kitty-border)', marginBottom: '12px', boxShadow: 'var(--shadow-sm)' }}>
                        <button 
                          type="button"
                          className="cute-btn-sm"
                          style={{ 
                            background: viewingHistoryIndex === salaryLogs.length - 1 ? '#F1F3F5' : 'white', 
                            color: viewingHistoryIndex === salaryLogs.length - 1 ? 'var(--kitty-text-light)' : 'var(--kitty-blue)', 
                            borderColor: 'var(--kitty-border)',
                            padding: '6px 10px',
                            cursor: viewingHistoryIndex === salaryLogs.length - 1 ? 'default' : 'pointer'
                          }}
                          onClick={prevMonth}
                          disabled={viewingHistoryIndex === salaryLogs.length - 1}
                        >
                          ย้อนกลับ
                        </button>
                        
                        <span className="num-font" style={{ fontWeight: 800, fontSize: '13px', color: 'var(--kitty-text)' }}>
                          {currentLog?.month}
                        </span>

                        <button 
                          type="button"
                          className="cute-btn-sm"
                          style={{ 
                            background: viewingHistoryIndex === 0 ? '#F1F3F5' : 'white', 
                            color: viewingHistoryIndex === 0 ? 'var(--kitty-text-light)' : 'var(--kitty-blue)', 
                            borderColor: 'var(--kitty-border)',
                            padding: '6px 10px',
                            cursor: viewingHistoryIndex === 0 ? 'default' : 'pointer'
                          }}
                          onClick={nextMonth}
                          disabled={viewingHistoryIndex === 0}
                        >
                          ถัดไป
                        </button>
                      </div>

                      {/* Allocation Card Details */}
                      <div style={{ background: 'var(--kitty-card-bg)', borderRadius: '16px', padding: '16px', border: '2px solid var(--kitty-border)', boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '2px dashed var(--kitty-border)', paddingBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--kitty-text)' }}>ยอดเงินเดือน:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="num-font" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--kitty-blue)' }}>
                              {formatMoney(currentLog?.amount || 0)}
                            </span>
                            {currentLog?.allocations && currentLog.allocations.length > 0 && (
                              <button 
                                type="button" 
                                className="cute-btn-sm" 
                                style={{ padding: '3px 6px', fontSize: '10px', background: 'var(--kitty-blue-light)', color: 'var(--kitty-blue)', borderColor: 'var(--kitty-blue-light)' }}
                                onClick={() => handleDuplicateLog(currentLog)}
                                title="คัดลอกสำหรับเดือนนี้"
                              >
                                คัดลอก
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--kitty-text-light)', marginBottom: '8px' }}>
                          แยกเข้าแต่ละบัญชี:
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {currentLog?.allocations && currentLog.allocations.length > 0 ? (
                            currentLog.allocations.map((alloc, i) => {
                              const accColor = accounts.find(a => a.id === alloc.accountId)?.color || 'var(--kitty-blue)';
                              return (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--kitty-bg)', borderRadius: '10px', border: '1px solid var(--kitty-border)' }}>
                                  <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--kitty-text)' }}>{alloc.accountName}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="num-font" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--kitty-text)' }}>
                                      {formatMoney(alloc.amount)}
                                    </span>
                                    <span 
                                      style={{
                                        display: 'inline-block',
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: accColor,
                                        boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--kitty-text-light)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                              ไม่มีข้อมูลแยกบัญชี
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()
      ) : (
        // Main Dashboard View (Summary, Salary Logs, Tabs)
        <>
          {/* Summary Card with Donut Chart */}
          <div className="summary-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div className="summary-label">ยอดเงินรวมทุกบัญชี</div>
              <div className="summary-amount" style={{ fontSize: '24px', marginBottom: '4px' }}>{formatMoney(totalBalance)}</div>
              <div className="summary-stats" style={{ border: 'none', padding: 0 }}>
                <div className="stat-item">
                  <span className="stat-label">เป้าหมายรวม: {formatMoney(totalGoal)}</span>
                </div>
              </div>
            </div>

            {/* Donut Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '76px', 
                height: '76px', 
                borderRadius: '50%', 
                background: `conic-gradient(${conicGradientString})`, 
                border: '2.5px solid white', 
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '54px',
                  height: '54px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '50%',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)'
                }} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'white' }}>{overallPercentage}% สำเร็จ</span>
            </div>
          </div>

          {/* Salary Logging Section (Simple Button trigger) */}
          <button 
            type="button"
            className="btn-submit" 
            style={{ margin: '0 0 10px 0', background: 'var(--kitty-blue)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: 'none', boxShadow: '0 3px 8px rgba(10, 102, 194, 0.2)', width: '100%', fontSize: '12px' }}
            onClick={() => setIsSalaryMenuOpen(true)}
          >
            <Sparkles size={14} fill="#FFFFFF" /> จัดการเงินเดือน
          </button>

          {/* Navigation Tabs */}
          <nav className="main-tabs">
            <button 
              className={`tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
              onClick={() => setActiveTab('accounts')}
            >
              <Wallet size={16} /> บัญชีของฉัน
            </button>
            <button 
              className={`tab-btn ${activeTab === 'transactions' ? 'active tx-tab' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              <Award size={16} /> ประวัติการเงิน
            </button>
          </nav>

          {/* Tab 1: Accounts list (simplified view) */}
          {activeTab === 'accounts' && (
            <div>
              <div className="section-title-bar">
                <h2 className="section-title">บัญชีทั้งหมด</h2>
                <span style={{ fontSize: '11px', color: 'var(--kitty-text-light)', fontWeight: 500 }}>
                  แตะที่บัญชีเพื่อจัดการธุรกรรม
                </span>
              </div>

              {accounts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-kitty">🐱</div>
                  <p>ยังไม่มีบัญชีการเงิน</p>
                </div>
              ) : (
                accounts.map(acc => {
                  const pct = acc.goal > 0 ? Math.min(Math.round((acc.balance / acc.goal) * 100), 100) : 0;
                  
                  return (
                    <div 
                      className="account-card" 
                      key={acc.id} 
                      onClick={() => setSelectedAccountId(acc.id)}
                      style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                    >
                      <div className="account-header">
                        <div className="account-meta" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <span className="account-name">{acc.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--kitty-text-light)', fontWeight: 600 }}>
                              {totalBalance > 0 ? ((acc.balance / totalBalance) * 100).toFixed(0) : 0}%
                            </span>
                          </div>
                          {acc.purpose && (
                            <span style={{ fontSize: '12px', color: 'var(--kitty-text-light)', marginTop: '2px' }}>
                              จุดประสงค์: {acc.purpose}
                            </span>
                          )}
                          <span className="account-date">สร้างเมื่อ {new Date(acc.createdAt).toLocaleDateString('th-TH')}</span>
                        </div>
                      </div>

                      <div className="account-balance-area" style={{ marginBottom: acc.goal > 0 ? '8px' : '0px' }}>
                        <span className="account-val">{formatMoney(acc.balance)}</span>
                        {acc.goal > 0 && (
                          <span className="account-goal-val">
                            เป้าหมาย: {formatMoney(acc.goal)}
                          </span>
                        )}
                      </div>

                      {acc.goal > 0 && (
                        <div className="progress-container">
                          <div className="progress-label-bar">
                            <span style={{ color: acc.color || 'var(--kitty-blue)', fontWeight: 600 }}>ความคืบหน้า</span>
                            <span style={{ color: acc.color || 'var(--kitty-blue)', fontWeight: 600 }}>{pct}%</span>
                          </div>
                          <div className="progress-track">
                            <div 
                              className="progress-fill"
                              style={{ width: `${pct}%`, background: acc.color || 'var(--kitty-blue)' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Transactions list */}
      {activeTab === 'transactions' && (
        <div>
          <div className="section-title-bar">
            <h2 className="section-title">ประวัติการเงิน</h2>
            <button className="cute-btn-sm" style={{ background: 'var(--kitty-blue-light)', color: 'var(--kitty-blue)', borderColor: 'var(--kitty-blue-light)' }} onClick={() => openTxModal('income')}>
              เพิ่มรายการ
            </button>
          </div>

          <div className="transaction-list">
            {transactions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-kitty">💸</div>
                <p>ยังไม่มีรายการธุรกรรม</p>
              </div>
            ) : (
              transactions.map(tx => {
                const acc = accounts.find(a => a.id === tx.accountId);
                const targetAcc = tx.targetAccountId ? accounts.find(a => a.id === tx.targetAccountId) : null;
                
                return (
                  <div className="transaction-item" key={tx.id}>
                    <div className="tx-info">
                      <div className={`tx-icon ${tx.type}`}>
                        {tx.type === 'income' && <Plus size={16} />}
                        {tx.type === 'expense' && <Minus size={16} />}
                        {tx.type === 'transfer' && <ArrowLeftRight size={16} />}
                      </div>
                      <div className="tx-desc-area">
                        <span className="tx-desc">
                          {tx.description.replace(/🌸|🎀|💖|💼/g, '').replace('จัดสรร', '').trim()}
                        </span>
                        <span className="tx-account" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                          <span>
                            {tx.type === 'transfer' 
                              ? `โอนจาก: ${acc?.name || 'บัญชีที่ถูกลบ'} ➔ ไปยัง: ${targetAcc?.name || 'บัญชีที่ถูกลบ'}`
                              : `บัญชี: ${acc?.name || 'บัญชีที่ถูกลบ'}`}
                          </span>
                          <span style={{ fontSize: '9px', color: 'var(--kitty-text-light)' }}>
                            วันที่: {tx.date}
                          </span>
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span className={`tx-amount ${tx.type}`} style={{ whiteSpace: 'nowrap' }}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatMoney(tx.amount)}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span 
                          style={{
                            display: 'inline-block',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: acc?.color || 'var(--kitty-blue)',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                          }}
                          title={acc?.name}
                        />
                        {tx.type === 'transfer' && targetAcc && (
                          <>
                            <span style={{ fontSize: '10px', color: 'var(--kitty-text-light)' }}>➔</span>
                            <span 
                              style={{
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: targetAcc.color || 'var(--kitty-blue)',
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                              }}
                              title={targetAcc.name}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
        </>
      )}


      {/* --- MODAL: Create Transaction --- */}
      {isTxModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTxModalOpen(false)}>
          <div className="cute-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {txModalMode === 'income' ? 'ฝากเงิน' : txModalMode === 'expense' ? 'ถอนเงิน' : 'โอนเงิน'}
              </h3>
              <button className="btn-close" onClick={() => setIsTxModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Quick type switcher inside Modal */}
            <div className="main-tabs" style={{ marginBottom: '15px' }}>
              <button 
                type="button" 
                className={`tab-btn ${txModalMode === 'income' ? 'active' : ''}`}
                onClick={() => setTxModalMode('income')}
              >
                ฝาก
              </button>
              <button 
                type="button" 
                className={`tab-btn ${txModalMode === 'expense' ? 'active' : ''}`}
                onClick={() => setTxModalMode('expense')}
                style={txModalMode === 'expense' ? { background: 'var(--kitty-red)', color: 'white', borderColor: 'var(--kitty-red)' } : {}}
              >
                ถอน
              </button>
              {accounts.length > 1 && (
                <button 
                  type="button" 
                  className={`tab-btn ${txModalMode === 'transfer' ? 'active' : ''}`}
                  onClick={() => setTxModalMode('transfer')}
                  style={txModalMode === 'transfer' ? { background: '#B28200', color: 'white', borderColor: '#B28200' } : {}}
                >
                  โอน
                </button>
              )}
            </div>

            <form onSubmit={handleCreateTransaction}>
              <div className="form-group">
                <label className="form-label">
                  {txModalMode === 'transfer' ? 'จากบัญชี (ต้นทาง)' : 'สำหรับบัญชี'}
                </label>
                <select 
                  className="cute-select"
                  value={txAccountId}
                  onChange={e => setTxAccountId(e.target.value)}
                  required
                >
                  <option value="" disabled>เลือกบัญชี</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (ยอดเหลือ: {acc.balance}฿)</option>
                  ))}
                </select>
              </div>

              {txModalMode === 'transfer' && (
                <div className="form-group">
                  <label className="form-label">ไปยังบัญชี (ปลายทาง)</label>
                  <select 
                    className="cute-select"
                    value={txTargetAccountId}
                    onChange={e => setTxTargetAccountId(e.target.value)}
                    required
                  >
                    <option value="" disabled>เลือกบัญชีปลายทาง</option>
                    {accounts.filter(acc => acc.id !== txAccountId).map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (ยอดเหลือ: {acc.balance}฿)</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">จำนวนเงิน (บาท)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="cute-input"
                    value={txAmount}
                    onChange={e => setTxAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">วันที่</label>
                  <input 
                    type="date" 
                    className="cute-input"
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">รายละเอียด / คำอธิบาย</label>
                <input 
                  type="text" 
                  placeholder={txModalMode === 'income' ? 'เช่น เงินคืนเพื่อน, ปันผล' : txModalMode === 'expense' ? 'เช่น ค่าอาหาร, ซื้อของเล่น' : 'เช่น โอนเก็บเงินออม'}
                  className="cute-input"
                  value={txDesc}
                  onChange={e => setTxDesc(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-submit" style={txModalMode === 'income' ? { background: 'var(--kitty-blue)' } : txModalMode === 'expense' ? { background: 'var(--kitty-red)' } : { background: '#B28200' }}>
                บันทึกรายการ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Salary Management Menu (Popup version) --- */}
      {isSalaryMenuOpen && (
        <div className="modal-overlay" onClick={() => setIsSalaryMenuOpen(false)}>
          <div className="cute-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                จัดการเงินเดือน
              </h3>
              <button className="btn-close" onClick={() => setIsSalaryMenuOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                type="button"
                className="btn-submit"
                style={{ 
                  margin: 0, 
                  background: isSalaryLoggedThisMonth ? 'var(--kitty-yellow-light)' : 'var(--kitty-blue)', 
                  color: isSalaryLoggedThisMonth ? '#5C4300' : 'white',
                  border: isSalaryLoggedThisMonth ? '2px dashed var(--kitty-yellow)' : 'none',
                  boxShadow: isSalaryLoggedThisMonth ? 'none' : '0 4px 10px rgba(10, 102, 194, 0.2)',
                  padding: '14px'
                }}
                onClick={() => {
                  setIsSalaryMenuOpen(false);
                  setIsLoggingSalaryViewActive(true);
                }}
              >
                {isSalaryLoggedThisMonth ? `เงินเดือนเดือนนี้บันทึกแล้ว (บันทึกซ้ำ)` : `บันทึกเงินเดือนเดือนนี้`}
              </button>

              <button 
                type="button"
                className="btn-submit"
                style={{ margin: 0, background: 'var(--kitty-red-light)', color: 'var(--kitty-red)', border: '1px solid var(--kitty-red-light)', boxShadow: 'none', padding: '14px' }}
                onClick={() => {
                  setIsSalaryMenuOpen(false);
                  setIsSalaryHistoryOpen(true);
                }}
              >
                ดูประวัติเงินเดือน
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- MODAL: Salary Log Review --- */}
      {isSalaryReviewOpen && (
        <div className="modal-overlay" onClick={() => setIsSalaryReviewOpen(false)}>
          <div className="cute-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                ตรวจสอบข้อมูล
              </h3>
              <button className="btn-close" onClick={() => setIsSalaryReviewOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--kitty-text)' }}>
                  เดือนที่บันทึก:
                </label>
                <input 
                  type="month" 
                  className="cute-input"
                  style={{ width: '100%', border: '2px solid var(--kitty-blue)' }}
                  value={salaryMonth}
                  onChange={e => setSalaryMonth(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--kitty-text-light)', marginTop: '5px', display: 'block', lineHeight: '1.4' }}>
                  * สำหรับ iPhone: แตะที่ช่องด้านบนเพื่อเลือกเดือนและปี
                </span>
              </div>

              <div style={{ background: 'var(--kitty-bg)', borderRadius: '18px', padding: '16px', border: '1.5px solid var(--kitty-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px dashed var(--kitty-border)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--kitty-text-light)' }}>ยอดเงินเดือนรวม:</span>
                  <span className="num-font" style={{ fontWeight: 800, fontSize: '16px', color: 'var(--kitty-blue)' }}>
                    {formatMoney(totalSalary)}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {salaryAllocations.map((alloc, idx) => {
                    const accName = accounts.find(a => a.id === alloc.accountId)?.name || 'บัญชี';
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--kitty-text)', fontWeight: 600 }}>{accName.split(' ')[0]}</span>
                        <span className="num-font" style={{ color: 'var(--kitty-text)', fontWeight: 700 }}>
                          {formatMoney(parseFloat(alloc.amount) || 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="cute-btn-sm" 
                  style={{ flex: 1, justifyContent: 'center', background: '#F1F3F5', color: 'var(--kitty-text)', borderColor: 'var(--kitty-border)', padding: '12px' }}
                  onClick={() => setIsSalaryReviewOpen(false)}
                >
                  แก้ไขข้อมูล
                </button>
                <button 
                  type="button" 
                  className="btn-submit" 
                  style={{ flex: 1, margin: 0, padding: '12px', background: 'var(--kitty-yellow)', color: '#5C4300' }}
                  onClick={confirmAndSaveSalary}
                >
                  ยืนยันการบันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Edit Account --- */}
      {isEditAccModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEditAccModalOpen(false)}>
          <div className="cute-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                แก้ไขบัญชี
              </h3>
              <button className="btn-close" onClick={() => setIsEditAccModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount}>
              <div className="form-group">
                <label className="form-label">ชื่อบัญชี</label>
                <input 
                  type="text" 
                  className="cute-input"
                  value={editAccName}
                  onChange={e => setEditAccName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">ธนาคาร</label>
                <input 
                  type="text" 
                  placeholder="เช่น กสิกรไทย, ไทยพาณิชย์"
                  className="cute-input"
                  value={editAccBank}
                  onChange={e => setEditAccBank(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">จุดประสงค์บัญชี</label>
                <input 
                  type="text" 
                  placeholder="ระบุจุดประสงค์การแบ่งเงิน"
                  className="cute-input"
                  value={editAccPurpose}
                  onChange={e => setEditAccPurpose(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">เป้าหมายบัญชี (บาท - ไม่บังคับ)</label>
                <input 
                  type="number" 
                  placeholder="ไม่ระบุเป้าหมาย"
                  className="cute-input"
                  value={editAccGoal}
                  onChange={e => setEditAccGoal(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">สีประจำบัญชี</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {['#E60024', '#0A66C2', '#FFCC00', '#2ECC71', '#9B59B6', '#E67E22'].map(color => (
                    <button
                      key={color}
                      type="button"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: editAccColor === color ? '3px solid #FFF' : '1px solid rgba(0,0,0,0.1)',
                        boxShadow: editAccColor === color ? '0 0 0 2px var(--kitty-text)' : 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      onClick={() => setEditAccColor(color)}
                    />
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '12px', color: 'var(--kitty-text-light)' }}>เลือกสีอื่น:</span>
                    <input 
                      type="color" 
                      value={editAccColor} 
                      onChange={e => setEditAccColor(e.target.value)}
                      style={{
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        padding: 0,
                        cursor: 'pointer',
                        backgroundColor: 'transparent'
                      }}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-submit" style={{ background: 'var(--kitty-yellow)', color: '#5C4300' }}>
                บันทึกการเปลี่ยนแปลง
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Custom Alert/Confirm --- */}
      {alertOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="cute-modal" style={{ 
            maxWidth: '380px', 
            borderRadius: '24px', 
            borderTop: '4px solid var(--kitty-blue)', 
            margin: '20px',
            animation: 'none'
          }}>
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <h3 className="modal-title" style={{ color: 'var(--kitty-blue)' }}>
                {alertTitle}
              </h3>
            </div>
            <div style={{ marginBottom: '24px', fontSize: '15px', color: 'var(--kitty-text)', lineHeight: '1.6' }}>
              {alertMessage}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {alertType === 'confirm' && (
                <button 
                  className="btn-op minus" 
                  style={{ 
                    padding: '8px 18px', 
                    borderRadius: '12px', 
                    border: 'none', 
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px'
                  }} 
                  onClick={handleAlertCancel}
                >
                  ยกเลิก
                </button>
              )}
              <button 
                className="btn-op plus" 
                style={{ 
                  padding: '8px 18px', 
                  borderRadius: '12px', 
                  border: 'none', 
                  background: 'var(--kitty-blue)', 
                  color: 'white', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }} 
                onClick={handleAlertConfirm}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
