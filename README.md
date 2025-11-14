# MedVaultFHE: Encrypted Medical Records Vault

MedVaultFHE is a privacy-preserving application leveraging Zama's Fully Homomorphic Encryption (FHE) technology to keep patient medical records secure. By ensuring that sensitive health data remains encrypted, our solution allows healthcare providers to perform necessary computations on the data without ever exposing the original information, significantly enhancing patient confidentiality and data sovereignty.

## The Problem

In today's healthcare landscape, patient data is often stored in cleartext, making it vulnerable to unauthorized access and breaches. When medical records are accessed in an unprotected state, they can lead to severe consequences, including identity theft, privacy violations, and misuse of sensitive information. This issue is particularly critical as healthcare data is among the most sensitive and personal information individuals possess. The need for a secure method to handle and process this data has never been more pressing.

## The Zama FHE Solution

Fully Homomorphic Encryption enables computation on encrypted data, allowing healthcare providers to analyze and derive insights without ever needing to access the cleartext data. With Zama's technologies, such as fhevm, MedVaultFHE ensures that patient records are stored encrypted and only provide derived results when required. This means that physicians can receive actionable insights without compromising patient privacy, thus upholding the trust between patients and healthcare providers.

## Key Features

- 🔒 **Patient-Centric Data Control**: Patients retain full control over their medical records, accessing and sharing only the necessary information.
- 📊 **Homomorphic Statistics Support**: Perform statistical analyses on encrypted data while preserving patient confidentiality.
- 🛡️ **Fine-Grained Access Control**: Specify granular permissions for healthcare professionals, tailoring access levels to their roles.
- 💡 **Secure Data Sharing**: Enable trusted sharing of medical insights without exposing the underlying sensitive data.
- 📈 **Scalable Architecture**: Built to handle the increasing volume of medical records and computations without sacrificing performance.

## Technical Architecture & Stack

MedVaultFHE is developed using the following technology stack:

- **Core Privacy Engine**: Zama's FHE technology (fhevm)
- **Backend**: Python
- **Frontend**: React
- **Database**: Encrypted storage solutions
- **Deployment**: Docker for containerization

This stack enables a secure, scalable, and performant application that meets the stringent privacy requirements of the healthcare industry.

## Smart Contract / Core Logic

Here's a simplified pseudo-code example demonstrating how Zama's functionalities could be utilized in our application.

```solidity
// MedVaultFHE.sol
pragma solidity ^0.8.0;

import "TFHE.sol";

contract MedVaultFHE {
    function storeEncryptedRecord(uint64 encryptedRecord) public {
        // Store encrypted medical record using homomorphic encryption
        TFHE.store(encryptedRecord);
    }

    function retrieveDecryptedResult() public view returns (uint64) {
        // Retrieve computed result on encrypted data
        return TFHE.decrypt(TFHE.query());
    }
}
```

In this example, we store and retrieve encrypted medical records securely, leveraging Zama's encryption primitives.

## Directory Structure

Here's a high-level overview of the project directory structure:

```
/MedVaultFHE
├── contracts
│   └── MedVaultFHE.sol
├── src
│   ├── main.py
│   └── utils.py
├── tests
│   └── test_medvault.py
├── requirements.txt
└── Dockerfile
```

- `contracts/MedVaultFHE.sol`: The smart contract that handles medical records.
- `src/main.py`: The main application logic for managing records.
- `tests/test_medvault.py`: The test suite for verifying functionality.
- `requirements.txt`: Contains Python dependencies.
- `Dockerfile`: For deploying the application in a containerized environment.

## Installation & Setup

To get started with MedVaultFHE, ensure you have the following prerequisites installed on your machine:

- Python 3.x
- Node.js
- Docker

### Prerequisites

Begin by installing the necessary dependencies. Use the package managers as follows:

```bash
pip install concrete-ml
npm install fhevm
```

Make sure to also install any other dependencies listed in `requirements.txt`:

```bash
pip install -r requirements.txt
```

## Build & Run

Once the dependencies are set up, you can build and run the application using the following commands:

1. Compile the smart contract:

```bash
npx hardhat compile
```

2. Run the main application:

```bash
python src/main.py
```

3. (Optional) Use Docker to build and run the application:

```bash
docker build -t medvaultfhe .
docker run -p 5000:5000 medvaultfhe
```

## Acknowledgements

We would like to extend our gratitude to Zama for providing the open-source Fully Homomorphic Encryption primitives that make this project possible. Their groundbreaking technology empowers us to deliver a secure and innovative solution for managing medical records while respecting patient privacy.


