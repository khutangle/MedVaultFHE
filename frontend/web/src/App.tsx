import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface MedicalRecord {
  id: string;
  name: string;
  encryptedValue: string;
  age: number;
  bloodPressure: number;
  description: string;
  creator: string;
  timestamp: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface HealthStats {
  averageAge: number;
  highRiskCount: number;
  totalRecords: number;
  verifiedCount: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newRecordData, setNewRecordData] = useState({ 
    name: "", 
    age: "", 
    bloodPressure: "", 
    description: "" 
  });
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [healthStats, setHealthStats] = useState<HealthStats>({
    averageAge: 0,
    highRiskCount: 0,
    totalRecords: 0,
    verifiedCount: 0
  });
  const [showFAQ, setShowFAQ] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contractAddress, setContractAddress] = useState("");

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized) return;
      
      try {
        console.log('Initializing FHEVM for medical records...');
        await initialize();
      } catch (error) {
        console.error('FHEVM initialization failed:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHE加密系统初始化失败" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadRecords();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load medical records:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadRecords = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const recordsList: MedicalRecord[] = [];
      
      for (const businessId of businessIds) {
        try {
          const recordData = await contract.getBusinessData(businessId);
          recordsList.push({
            id: businessId,
            name: recordData.name,
            encryptedValue: businessId,
            age: Number(recordData.publicValue1) || 0,
            bloodPressure: Number(recordData.publicValue2) || 0,
            description: recordData.description,
            creator: recordData.creator,
            timestamp: Number(recordData.timestamp),
            isVerified: recordData.isVerified,
            decryptedValue: Number(recordData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading medical record:', e);
        }
      }
      
      setRecords(recordsList);
      updateHealthStats(recordsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "加载医疗记录失败" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const updateHealthStats = (recordsList: MedicalRecord[]) => {
    const total = recordsList.length;
    const verified = recordsList.filter(r => r.isVerified).length;
    const avgAge = total > 0 ? recordsList.reduce((sum, r) => sum + r.age, 0) / total : 0;
    const highRisk = recordsList.filter(r => r.bloodPressure > 140).length;

    setHealthStats({
      averageAge: avgAge,
      highRiskCount: highRisk,
      totalRecords: total,
      verifiedCount: verified
    });
  };

  const createRecord = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "请先连接钱包" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingRecord(true);
    setTransactionStatus({ visible: true, status: "pending", message: "使用Zama FHE创建加密病历..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("获取合约失败");
      
      const bloodPressureValue = parseInt(newRecordData.bloodPressure) || 0;
      const recordId = `medical-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, bloodPressureValue);
      
      const tx = await contract.createBusinessData(
        recordId,
        newRecordData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newRecordData.age) || 0,
        0,
        newRecordData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "等待交易确认..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "病历创建成功！" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadRecords();
      setShowCreateModal(false);
      setNewRecordData({ name: "", age: "", bloodPressure: "", description: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "用户取消交易" 
        : "提交失败: " + (e.message || "未知错误");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingRecord(false); 
    }
  };

  const decryptData = async (recordId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "请先连接钱包" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const recordData = await contractRead.getBusinessData(recordId);
      if (recordData.isVerified) {
        const storedValue = Number(recordData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "数据已在链上验证" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(recordId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(recordId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "链上验证解密中..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadRecords();
      
      setTransactionStatus({ visible: true, status: "success", message: "数据解密验证成功！" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "数据已在链上验证" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadRecords();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "解密失败: " + (e.message || "未知错误") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: isAvailable ? "FHE系统运行正常" : "系统维护中" 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "系统检查失败" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredRecords = records.filter(record =>
    record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderHealthStats = () => {
    return (
      <div className="stats-grid">
        <div className="stat-card gold-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>总病历数</h3>
            <div className="stat-value">{healthStats.totalRecords}</div>
            <div className="stat-label">加密存储</div>
          </div>
        </div>
        
        <div className="stat-card silver-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>已验证数据</h3>
            <div className="stat-value">{healthStats.verifiedCount}</div>
            <div className="stat-label">链上验证</div>
          </div>
        </div>
        
        <div className="stat-card bronze-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>平均年龄</h3>
            <div className="stat-value">{healthStats.averageAge.toFixed(1)}</div>
            <div className="stat-label">岁</div>
          </div>
        </div>
        
        <div className="stat-card copper-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>高风险病例</h3>
            <div className="stat-value">{healthStats.highRiskCount}</div>
            <div className="stat-label">血压>140</div>
          </div>
        </div>
      </div>
    );
  };

  const renderFHEProcess = () => {
    return (
      <div className="fhe-process">
        <div className="process-step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>数据加密</h4>
            <p>敏感医疗数据使用Zama FHE加密</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>链上存储</h4>
            <p>加密数据安全存储在区块链上</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>同态计算</h4>
            <p>直接对加密数据进行统计分析</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">4</div>
          <div className="step-content">
            <h4>安全验证</h4>
            <p>解密结果在链上验证真实性</p>
          </div>
        </div>
      </div>
    );
  };

  const renderFAQ = () => {
    return (
      <div className="faq-section">
        <h3>常见问题解答</h3>
        <div className="faq-list">
          <div className="faq-item">
            <h4>什么是FHE同态加密？</h4>
            <p>全同态加密允许直接对加密数据进行计算，无需解密即可获得计算结果，保护患者隐私。</p>
          </div>
          <div className="faq-item">
            <h4>医生能看到原始数据吗？</h4>
            <p>不能。医生只能获得统计分析结果，无法访问原始医疗数据，确保患者数据主权。</p>
          </div>
          <div className="faq-item">
            <h4>数据安全如何保障？</h4>
            <p>采用区块链存储加密数据，结合Zama FHE技术，实现端到端加密和可验证计算。</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header metal-header">
          <div className="logo">
            <h1>MedVaultFHE 🔐</h1>
            <span>病歷隱私金庫</span>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt metal-bg">
          <div className="connection-content">
            <div className="connection-icon">🏥</div>
            <h2>连接钱包访问加密病历系统</h2>
            <p>使用您的钱包连接以初始化FHE加密医疗记录存储系统</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>点击上方按钮连接钱包</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE加密系统自动初始化</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>开始管理加密医疗记录</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="loading-screen metal-bg">
        <div className="fhe-spinner metal-spinner"></div>
        <p>初始化FHE医疗加密系统...</p>
        <p className="loading-note">正在加载同态加密模块</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen metal-bg">
      <div className="fhe-spinner metal-spinner"></div>
      <p>加载加密医疗记录...</p>
    </div>
  );

  return (
    <div className="app-container metal-theme">
      <header className="app-header metal-header">
        <div className="logo">
          <h1>MedVaultFHE 🔐</h1>
          <span>安全医疗数据隐私保护</span>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={checkAvailability}
            className="system-check-btn metal-btn"
          >
            系统检查
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn metal-btn gold"
          >
            + 新建病历
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="dashboard-section">
          <h2>医疗数据统计看板 (FHE 🔐)</h2>
          {renderHealthStats()}
          
          <div className="fhe-explanation metal-panel">
            <h3>FHE同态加密流程</h3>
            {renderFHEProcess()}
          </div>
        </div>
        
        <div className="records-section">
          <div className="section-header">
            <h2>医疗记录管理</h2>
            <div className="header-actions">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="搜索病历名称或描述..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input metal-input"
                />
              </div>
              <button 
                onClick={loadRecords} 
                className="refresh-btn metal-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "刷新中..." : "刷新"}
              </button>
              <button 
                onClick={() => setShowFAQ(!showFAQ)}
                className="faq-btn metal-btn"
              >
                {showFAQ ? "隐藏FAQ" : "显示FAQ"}
              </button>
            </div>
          </div>
          
          {showFAQ && renderFAQ()}
          
          <div className="records-list">
            {filteredRecords.length === 0 ? (
              <div className="no-records metal-panel">
                <p>暂无医疗记录</p>
                <button 
                  className="create-btn metal-btn gold" 
                  onClick={() => setShowCreateModal(true)}
                >
                  创建第一条记录
                </button>
              </div>
            ) : filteredRecords.map((record, index) => (
              <div 
                className={`record-item metal-card ${selectedRecord?.id === record.id ? "selected" : ""} ${record.isVerified ? "verified" : ""}`} 
                key={index}
                onClick={() => setSelectedRecord(record)}
              >
                <div className="record-header">
                  <div className="record-title">{record.name}</div>
                  <div className={`record-status ${record.isVerified ? "verified" : "pending"}`}>
                    {record.isVerified ? "✅ 已验证" : "🔓 待验证"}
                  </div>
                </div>
                <div className="record-meta">
                  <span>年龄: {record.age}岁</span>
                  <span>血压: {record.bloodPressure}</span>
                  <span>创建: {new Date(record.timestamp * 1000).toLocaleDateString()}</span>
                </div>
                <div className="record-description">{record.description}</div>
                <div className="record-creator">创建者: {record.creator.substring(0, 6)}...{record.creator.substring(38)}</div>
                {record.isVerified && record.decryptedValue && (
                  <div className="record-decrypted">
                    加密血压值: {record.decryptedValue} (链上验证)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateRecord 
          onSubmit={createRecord} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingRecord} 
          recordData={newRecordData} 
          setRecordData={setNewRecordData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedRecord && (
        <RecordDetailModal 
          record={selectedRecord} 
          onClose={() => setSelectedRecord(null)} 
          isDecrypting={fheIsDecrypting} 
          decryptData={() => decryptData(selectedRecord.id)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal metal-modal">
          <div className="transaction-content metal-panel">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner metal-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateRecord: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  recordData: any;
  setRecordData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, recordData, setRecordData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'age' || name === 'bloodPressure') {
      const intValue = value.replace(/[^\d]/g, '');
      setRecordData({ ...recordData, [name]: intValue });
    } else {
      setRecordData({ ...recordData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay metal-overlay">
      <div className="create-record-modal metal-modal">
        <div className="modal-header metal-header">
          <h2>新建医疗记录</h2>
          <button onClick={onClose} className="close-modal metal-close">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice metal-notice">
            <strong>FHE 🔐 同态加密</strong>
            <p>血压数据将使用Zama FHE进行加密存储（仅支持整数）</p>
          </div>
          
          <div className="form-group">
            <label>患者姓名 *</label>
            <input 
              type="text" 
              name="name" 
              value={recordData.name} 
              onChange={handleChange} 
              placeholder="输入患者姓名..." 
              className="metal-input"
            />
          </div>
          
          <div className="form-group">
            <label>年龄 *</label>
            <input 
              type="number" 
              name="age" 
              value={recordData.age} 
              onChange={handleChange} 
              placeholder="输入年龄..." 
              min="0"
              max="150"
              className="metal-input"
            />
            <div className="data-type-label">公开数据</div>
          </div>
          
          <div className="form-group">
            <label>血压值（整数）*</label>
            <input 
              type="number" 
              name="bloodPressure" 
              value={recordData.bloodPressure} 
              onChange={handleChange} 
              placeholder="输入血压值..." 
              step="1"
              min="0"
              className="metal-input"
            />
            <div className="data-type-label">FHE加密整数</div>
          </div>
          
          <div className="form-group">
            <label>病情描述</label>
            <textarea 
              name="description" 
              value={recordData.description} 
              onChange={handleChange} 
              placeholder="输入病情描述..." 
              className="metal-textarea"
              rows={3}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn metal-btn">取消</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !recordData.name || !recordData.age || !recordData.bloodPressure} 
            className="submit-btn metal-btn gold"
          >
            {creating || isEncrypting ? "加密并创建中..." : "创建记录"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RecordDetailModal: React.FC<{
  record: MedicalRecord;
  onClose: () => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ record, onClose, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    await decryptData();
  };

  return (
    <div className="modal-overlay metal-overlay">
      <div className="record-detail-modal metal-modal">
        <div className="modal-header metal-header">
          <h2>医疗记录详情</h2>
          <button onClick={onClose} className="close-modal metal-close">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="record-info">
            <div className="info-item">
              <span>患者姓名:</span>
              <strong>{record.name}</strong>
            </div>
            <div className="info-item">
              <span>创建者:</span>
              <strong>{record.creator.substring(0, 6)}...{record.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>创建时间:</span>
              <strong>{new Date(record.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-item">
              <span>年龄:</span>
              <strong>{record.age}岁</strong>
            </div>
            <div className="info-item">
              <span>血压:</span>
              <strong>{record.bloodPressure}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>加密医疗数据</h3>
            
            <div className="data-row">
              <div className="data-label">血压加密值:</div>
              <div className="data-value">
                {record.isVerified && record.decryptedValue ? 
                  `${record.decryptedValue} (链上已验证)` : 
                  "🔒 FHE加密整数"
                }
              </div>
              <button 
                className={`decrypt-btn metal-btn ${record.isVerified ? 'verified' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 验证中..."
                ) : record.isVerified ? (
                  "✅ 已验证"
                ) : (
                  "🔓 验证解密"
                )}
              </button>
            </div>
            
            <div className="fhe-info metal-notice">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE同态加密保护</strong>
                <p>血压数据在链上加密存储。点击"验证解密"进行离线解密和链上验证。</p>
              </div>
            </div>
          </div>
          
          <div className="description-section">
            <h3>病情描述</h3>
            <div className="description-content">{record.description}</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn metal-btn">关闭</button>
          {!record.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn metal-btn gold"
            >
              {isDecrypting ? "链上验证中..." : "链上验证"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


