// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHERacePredict
 * @notice A privacy-preserving contract for encrypted race prediction data.
 *         Each participant can submit and later retrieve their own encrypted information
 *         related to race outcomes or performance metrics.
 *
 * @dev This example demonstrates how to handle encrypted user inputs with
 *      Fully Homomorphic Encryption (FHE) using the Zama FHEVM framework.
 *      - All stored data remains encrypted on-chain.
 *      - Only the data owner can decrypt their own submissions.
 *      - The contract never reveals plaintext information.
 */
contract FHERacePredict is ZamaEthereumConfig {
    /// @dev Stores encrypted race data for each participant.
    mapping(address => euint32[]) private _encryptedSubmissions;

    /**
     * @notice Submit an encrypted race prediction or data point.
     * @param encryptedInput The encrypted integer value as `externalEuint32`.
     * @param proof Zero-knowledge proof validating the encrypted payload.
     *
     * @dev Converts external ciphertext → internal FHE value and stores it securely.
     *      Grants the sender permission to decrypt their own record.
     */
    function submitInfo(externalEuint32 encryptedInput, bytes calldata proof) external {
        // Convert from external ciphertext to internal representation
        euint32 input = FHE.fromExternal(encryptedInput, proof);

        // Allow internal operations within the contract
        FHE.allowThis(input);

        // Append encrypted data to the sender's record list
        _encryptedSubmissions[msg.sender].push(input);

        // Allow the sender to decrypt their own data later
        FHE.allow(input, msg.sender);
    }

    /**
     * @notice Retrieve all encrypted submissions made by a user.
     * @param user The address of the participant.
     * @return A list of encrypted integers (`euint32[]`) owned by the user.
     *
     * @dev Returned values are ciphertexts and must be decrypted off-chain
     *      by the rightful data owner using their private FHE keys.
     */
    function getInfoHistory(address user) external view returns (euint32[] memory) {
        return _encryptedSubmissions[user];
    }
}
