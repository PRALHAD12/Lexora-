import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Contract from "../features/contracts/Contract.model.js";

let RAG_SERVICE_URL =
  process.env.RAG_SERVICE_URL || "http://localhost:8000";

// If run directly on host machine (outside Docker), translate host.docker.internal to localhost
if (RAG_SERVICE_URL.includes("host.docker.internal")) {
  RAG_SERVICE_URL = RAG_SERVICE_URL.replace("host.docker.internal", "localhost");
}

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/lexora";

async function bulkReindexContracts() {
  console.log("==================================================");
  console.log("🚀 Starting Lexora Bulk Contract Re-Indexing to RAG");
  console.log(`📍 RAG Target URL: ${RAG_SERVICE_URL}`);
  console.log("==================================================");

  try {
    // 1. Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB Connected successfully.\n");

    // 2. Fetch all active contracts
    const contracts = await Contract.find({
      isDeleted: { $ne: true },
    }).lean();

    console.log(`📑 Found ${contracts.length} total active contracts.\n`);

    let indexedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalChunks = 0;

    // 3. Process each contract
    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i];
      const docText =
        (contract.content && contract.content.trim()) ||
        (contract.extractedText && contract.extractedText.trim()) ||
        "";

      const title = contract.title || contract.fileName || "Untitled Agreement";
      const contractId = contract._id.toString();

      if (!docText) {
        console.log(`⚠️  [${i + 1}/${contracts.length}] SKIPPED: "${title}" (ID: ${contractId}) — No text content.`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`🔄 [${i + 1}/${contracts.length}] Indexing: "${title}" (ID: ${contractId}, length: ${docText.length} chars)...`);

        const res = await fetch(`${RAG_SERVICE_URL}/api/rag/index`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract_id: contractId,
            title: title,
            user_id: contract.userId || "system",
            text: docText,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`❌ FAILED: "${title}" - HTTP ${res.status}: ${errText}`);
          errorCount++;
          continue;
        }

        const data = await res.json();
        const chunks = data?.data?.chunks_indexed || 0;
        totalChunks += chunks;
        indexedCount++;

        console.log(`✅ Indexed "${title}" → ${chunks} chunks stored in ChromaDB.`);
      } catch (err) {
        console.error(`❌ ERROR indexing contract ${contractId}:`, err.message);
        errorCount++;
      }
    }

    // 4. Summary
    console.log("\n==================================================");
    console.log("📊 RE-INDEXING SUMMARY:");
    console.log(`   Total Contracts Processed: ${contracts.length}`);
    console.log(`   ✅ Successfully Indexed:  ${indexedCount}`);
    console.log(`   ⏭️  Skipped (Empty):       ${skippedCount}`);
    console.log(`   ❌ Errors/Failed:          ${errorCount}`);
    console.log(`   📦 Total Chunks in RAG:    ${totalChunks}`);
    console.log("==================================================");
  } catch (error) {
    console.error("Fatal error during re-indexing:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected cleanly.");
  }
}

bulkReindexContracts();
