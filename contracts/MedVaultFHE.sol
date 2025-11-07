pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract MedVaultFHE is ZamaEthereumConfig {
    
    struct MedicalRecord {
        string patientId;                    
        euint32 encryptedData;        
        uint256 recordType;          
        uint256 accessLevel;          
        string metadata;            
        address patientAddress;               
        uint256 timestamp;             
        uint32 decryptedResult; 
        bool isProcessed; 
    }
    
    mapping(string => MedicalRecord) public medicalRecords;
    
    string[] public recordIds;
    
    event MedicalRecordCreated(string indexed recordId, address indexed patient);
    event ComputationVerified(string indexed recordId, uint32 result);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function createMedicalRecord(
        string calldata recordId,
        string calldata patientId,
        externalEuint32 encryptedData,
        bytes calldata inputProof,
        uint256 recordType,
        uint256 accessLevel,
        string calldata metadata
    ) external {
        require(bytes(medicalRecords[recordId].patientId).length == 0, "Medical record already exists");
        
        require(FHE.isInitialized(FHE.fromExternal(encryptedData, inputProof)), "Invalid encrypted input");
        
        medicalRecords[recordId] = MedicalRecord({
            patientId: patientId,
            encryptedData: FHE.fromExternal(encryptedData, inputProof),
            recordType: recordType,
            accessLevel: accessLevel,
            metadata: metadata,
            patientAddress: msg.sender,
            timestamp: block.timestamp,
            decryptedResult: 0,
            isProcessed: false
        });
        
        FHE.allowThis(medicalRecords[recordId].encryptedData);
        
        FHE.makePubliclyDecryptable(medicalRecords[recordId].encryptedData);
        
        recordIds.push(recordId);
        
        emit MedicalRecordCreated(recordId, msg.sender);
    }
    
    function verifyComputation(
        string calldata recordId, 
        bytes memory abiEncodedResult,
        bytes memory computationProof
    ) external {
        require(bytes(medicalRecords[recordId].patientId).length > 0, "Medical record does not exist");
        require(!medicalRecords[recordId].isProcessed, "Data already processed");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(medicalRecords[recordId].encryptedData);
        
        FHE.checkSignatures(cts, abiEncodedResult, computationProof);
        
        uint32 decodedResult = abi.decode(abiEncodedResult, (uint32));
        
        medicalRecords[recordId].decryptedResult = decodedResult;
        medicalRecords[recordId].isProcessed = true;
        
        emit ComputationVerified(recordId, decodedResult);
    }
    
    function getEncryptedData(string calldata recordId) external view returns (euint32) {
        require(bytes(medicalRecords[recordId].patientId).length > 0, "Medical record does not exist");
        return medicalRecords[recordId].encryptedData;
    }
    
    function getMedicalRecord(string calldata recordId) external view returns (
        string memory patientId,
        uint256 recordType,
        uint256 accessLevel,
        string memory metadata,
        address patientAddress,
        uint256 timestamp,
        bool isProcessed,
        uint32 decryptedResult
    ) {
        require(bytes(medicalRecords[recordId].patientId).length > 0, "Medical record does not exist");
        MedicalRecord storage data = medicalRecords[recordId];
        
        return (
            data.patientId,
            data.recordType,
            data.accessLevel,
            data.metadata,
            data.patientAddress,
            data.timestamp,
            data.isProcessed,
            data.decryptedResult
        );
    }
    
    function getAllRecordIds() external view returns (string[] memory) {
        return recordIds;
    }
    
    function isAvailable() public pure returns (bool) {
        return true;
    }
}


