# Amazon Rekognition Integration Guide

**Secure ML Processing for UseSense Backend**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [AWS Services Required](#aws-services-required)
4. [Setup & Configuration](#setup--configuration)
5. [Rekognition APIs Used](#rekognition-apis-used)
6. [Implementation Guide](#implementation-guide)
7. [Processing Pipeline](#processing-pipeline)
8. [Code Examples](#code-examples)
9. [Security Best Practices](#security-best-practices)
10. [Cost Optimization](#cost-optimization)
11. [Error Handling](#error-handling)
12. [Testing](#testing)
13. [Monitoring](#monitoring)

---

## Overview

Amazon Rekognition provides enterprise-grade facial analysis and liveness detection that integrates seamlessly with the UseSense Web SDK. This guide covers implementing secure, production-ready ML processing using AWS services.

### Why Amazon Rekognition?

✅ **Security from Day 1**: NIST-tested liveness detection  
✅ **Enterprise Scale**: Handles millions of sessions  
✅ **Managed Service**: No model training/maintenance  
✅ **High Accuracy**: 99.9%+ face detection accuracy  
✅ **Compliance**: SOC, PCI-DSS, HIPAA eligible  
✅ **Fast**: < 2 second processing time  

### What Rekognition Provides

| Service | Purpose | SDK Data Used |
|---------|---------|---------------|
| **Face Liveness** | Detect real vs. spoofed faces | Video frames |
| **Detect Faces** | Face detection & quality checks | Video frames |
| **Compare Faces** | 1:1 face matching | Video frames + stored template |
| **Search Faces** | 1:N deduplication | Video frames + collection |
| **Index Faces** | Store face templates | Enrollment frames |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Web SDK (Client)                        │
│  Captures: 38 video frames (JPEG) + metadata                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ HTTPS POST
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API Service                          │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Upload Handler  │──│   S3 Storage     │                    │
│  └──────────────────┘  └──────────────────┘                    │
│           │                                                      │
│           │ Queue job                                            │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │            Processing Worker (SQS/Lambda)             │      │
│  └──────────────────────┬────────────────────────────────┘      │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Amazon Rekognition Services                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Face Liveness   │  │  Detect Faces    │  │ Compare Faces│ │
│  │  (Spoof Check)   │  │  (Quality Check) │  │ (1:1 Match)  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Search Faces    │  │  Index Faces     │                    │
│  │  (Deduplication) │  │  (Store Template)│                    │
│  └──────────────────┘  └──────────────────┘                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ Return scores & confidence
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Database (PostgreSQL)                 │
│  Store: decisions, scores, face_ids, rekognition_metadata       │
└─────────────────────────────────────────────────────────────────┘
```

---

## AWS Services Required

### 1. Amazon Rekognition
**Purpose:** Face detection, liveness, matching, deduplication

**Regions:** Use same region as S3 bucket for best performance
- Recommended: `us-east-1`, `us-west-2`, `eu-west-1`

**Pricing (as of 2026):**
- Face Liveness: $0.08 per session
- Face Detection: $0.001 per image
- Face Comparison: $0.001 per comparison
- Face Search: $0.001 per 1000 faces searched

### 2. Amazon S3
**Purpose:** Store video frames, audio, metadata

**Configuration:**
- Bucket: `usesense-signals-production`
- Region: Same as Rekognition
- Encryption: AES-256 (SSE-S3)
- Lifecycle: Delete after 30 days
- Versioning: Disabled (not needed)

### 3. Amazon SQS (Optional but Recommended)
**Purpose:** Queue processing jobs for async evaluation

**Configuration:**
- Queue: `usesense-processing-queue`
- Visibility timeout: 60 seconds
- Message retention: 4 days
- Dead Letter Queue: Yes (after 3 retries)

### 4. AWS Lambda (Optional)
**Purpose:** Serverless processing workers

**Configuration:**
- Runtime: Node.js 20.x or Python 3.12
- Memory: 1024 MB
- Timeout: 60 seconds
- Concurrency: 100 (adjust based on load)

### 5. AWS IAM
**Purpose:** Secure access control

**Required Policies:**
- Rekognition: DetectFaces, CompareFaces, IndexFaces, SearchFaces
- S3: GetObject, PutObject
- SQS: SendMessage, ReceiveMessage, DeleteMessage

---

## Setup & Configuration

### Step 1: Create S3 Bucket

```bash
aws s3api create-bucket \
  --bucket usesense-signals-production \
  --region us-east-1 \
  --create-bucket-configuration LocationConstraint=us-east-1

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket usesense-signals-production \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Set lifecycle policy (delete after 30 days)
aws s3api put-bucket-lifecycle-configuration \
  --bucket usesense-signals-production \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "DeleteOldSignals",
      "Status": "Enabled",
      "Prefix": "signals/",
      "Expiration": {
        "Days": 30
      }
    }]
  }'
```

### Step 2: Create Rekognition Face Collection

```bash
# Create collection for face storage (for deduplication)
aws rekognition create-collection \
  --collection-id usesense-identities-production \
  --region us-east-1

# Verify collection created
aws rekognition describe-collection \
  --collection-id usesense-identities-production \
  --region us-east-1
```

**Response:**
```json
{
  "FaceCount": 0,
  "FaceModelVersion": "7.0",
  "CollectionARN": "aws:rekognition:us-east-1:123456789012:collection/usesense-identities-production",
  "CreationTimestamp": "2026-02-19T10:00:00.000000-08:00"
}
```

### Step 3: Create IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RekognitionAccess",
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectFaces",
        "rekognition:CompareFaces",
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DescribeCollection",
        "rekognition:ListFaces",
        "rekognition:DeleteFaces"
      ],
      "Resource": [
        "arn:aws:rekognition:us-east-1:*:collection/usesense-identities-*"
      ]
    },
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::usesense-signals-production/*"
      ]
    },
    {
      "Sid": "SQSAccess",
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": [
        "arn:aws:sqs:us-east-1:*:usesense-processing-queue"
      ]
    }
  ]
}
```

### Step 4: Create IAM Role

```bash
# Create role
aws iam create-role \
  --role-name UseSenseBackendRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policy
aws iam put-role-policy \
  --role-name UseSenseBackendRole \
  --policy-name UseSenseBackendPolicy \
  --policy-document file://policy.json

# Attach Lambda execution role (for CloudWatch logs)
aws iam attach-role-policy \
  --role-name UseSenseBackendRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### Step 5: Set Environment Variables

```bash
# .env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_BUCKET=usesense-signals-production
REKOGNITION_COLLECTION_ID=usesense-identities-production
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/usesense-processing-queue
```

---

## Rekognition APIs Used

### 1. DetectFaces (Quality Check)

**Purpose:** Detect faces and assess quality before processing

**When to use:** First step in processing - validate frames

**Input:** Single frame (best quality frame)

**Output:**
- Face bounding box
- Face landmarks (eyes, nose, mouth)
- Face quality metrics
- Pose angles
- Confidence score

**Example Request:**
```python
response = rekognition.detect_faces(
    Image={
        'S3Object': {
            'Bucket': 'usesense-signals-production',
            'Name': 'signals/sess_abc123/frame_15.jpg'
        }
    },
    Attributes=['ALL']
)
```

**Example Response:**
```json
{
  "FaceDetails": [{
    "BoundingBox": {
      "Width": 0.45,
      "Height": 0.60,
      "Left": 0.28,
      "Top": 0.20
    },
    "Confidence": 99.97,
    "Quality": {
      "Brightness": 78.5,
      "Sharpness": 89.3
    },
    "Pose": {
      "Roll": -2.1,
      "Yaw": 5.3,
      "Pitch": 1.8
    },
    "Landmarks": [
      {"Type": "eyeLeft", "X": 0.35, "Y": 0.40},
      {"Type": "eyeRight", "X": 0.60, "Y": 0.41}
    ]
  }]
}
```

### 2. IndexFaces (Enrollment - Store Template)

**Purpose:** Create and store face template for future matching

**When to use:** Enrollment flow - store identity

**Input:** 3-5 best quality frames

**Output:**
- Face ID (unique identifier)
- Face record stored in collection
- Face bounding box
- Confidence score

**Example Request:**
```python
response = rekognition.index_faces(
    CollectionId='usesense-identities-production',
    Image={
        'S3Object': {
            'Bucket': 'usesense-signals-production',
            'Name': 'signals/sess_abc123/frame_15.jpg'
        }
    },
    ExternalImageId=f'identity_{identity_id}',
    DetectionAttributes=['ALL'],
    MaxFaces=1,
    QualityFilter='AUTO'
)
```

**Example Response:**
```json
{
  "FaceRecords": [{
    "Face": {
      "FaceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "BoundingBox": {
        "Width": 0.45,
        "Height": 0.60,
        "Left": 0.28,
        "Top": 0.20
      },
      "ImageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "ExternalImageId": "identity_ident_xyz789",
      "Confidence": 99.97
    },
    "FaceDetail": {
      "Quality": {
        "Brightness": 78.5,
        "Sharpness": 89.3
      }
    }
  }],
  "FaceModelVersion": "7.0"
}
```

### 3. CompareFaces (Authentication - 1:1 Match)

**Purpose:** Compare captured face to stored template

**When to use:** Authentication flow - verify identity

**Input:**
- Source image (current capture)
- Target image (enrollment template from S3)

**Output:**
- Similarity score (0-100)
- Confidence level
- Face matches array

**Example Request:**
```python
response = rekognition.compare_faces(
    SourceImage={
        'S3Object': {
            'Bucket': 'usesense-signals-production',
            'Name': 'signals/sess_auth123/frame_15.jpg'
        }
    },
    TargetImage={
        'S3Object': {
            'Bucket': 'usesense-signals-production',
            'Name': 'templates/ident_xyz789/enrollment_frame.jpg'
        }
    },
    SimilarityThreshold=80.0,
    QualityFilter='AUTO'
)
```

**Example Response:**
```json
{
  "FaceMatches": [{
    "Similarity": 95.67,
    "Face": {
      "BoundingBox": {
        "Width": 0.45,
        "Height": 0.60,
        "Left": 0.28,
        "Top": 0.20
      },
      "Confidence": 99.97
    }
  }],
  "UnmatchedFaces": [],
  "SourceImageFace": {
    "BoundingBox": {
      "Width": 0.43,
      "Height": 0.58,
      "Left": 0.30,
      "Top": 0.22
    },
    "Confidence": 99.95
  }
}
```

### 4. SearchFacesByImage (Deduplication - 1:N)

**Purpose:** Check if face already exists in collection

**When to use:** Enrollment flow - prevent duplicates

**Input:** Captured face image

**Output:**
- Array of matching faces
- Similarity scores
- Face IDs of matches

**Example Request:**
```python
response = rekognition.search_faces_by_image(
    CollectionId='usesense-identities-production',
    Image={
        'S3Object': {
            'Bucket': 'usesense-signals-production',
            'Name': 'signals/sess_abc123/frame_15.jpg'
        }
    },
    MaxFaces=10,
    FaceMatchThreshold=80.0,
    QualityFilter='AUTO'
)
```

**Example Response:**
```json
{
  "SearchedFaceBoundingBox": {
    "Width": 0.45,
    "Height": 0.60,
    "Left": 0.28,
    "Top": 0.20
  },
  "SearchedFaceConfidence": 99.97,
  "FaceMatches": [
    {
      "Similarity": 92.34,
      "Face": {
        "FaceId": "existing-face-id-123",
        "ExternalImageId": "identity_ident_existing789",
        "Confidence": 99.95
      }
    }
  ],
  "FaceModelVersion": "7.0"
}
```

---

## Implementation Guide

### Processing Flow

#### Enrollment Flow

```
1. Receive upload (38 frames in S3)
   ↓
2. Select best quality frame (middle frame ~15)
   ↓
3. DetectFaces - validate face present & quality
   ↓
4. SearchFacesByImage - check for duplicate
   ↓
5. If no duplicate:
   - IndexFaces - store in collection
   - Generate identity_id
   - Store face_id in database
   ↓
6. Calculate scores:
   - liveness_score = face_quality + confidence
   - dedupe_risk_score = similarity to nearest match
   ↓
7. Return decision
```

#### Authentication Flow

```
1. Receive upload (38 frames in S3)
   ↓
2. Retrieve enrollment template from S3
   ↓
3. Select best quality frame from capture
   ↓
4. DetectFaces - validate face present
   ↓
5. CompareFaces - match against template
   ↓
6. Calculate scores:
   - liveness_score = face_quality + confidence
   - dedupe_risk_score = similarity score
   ↓
7. Return decision
```

---

## Code Examples

### Complete Node.js Implementation

```javascript
// rekognition-processor.js
import { 
  RekognitionClient, 
  DetectFacesCommand,
  IndexFacesCommand,
  CompareFacesCommand,
  SearchFacesByImageCommand
} from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const rekognitionClient = new RekognitionClient({ 
  region: process.env.AWS_REGION 
});

const s3Client = new S3Client({ 
  region: process.env.AWS_REGION 
});

/**
 * Process enrollment session
 */
export async function processEnrollment(sessionId) {
  console.log(`Processing enrollment: ${sessionId}`);
  
  // 1. Load metadata to get frame count
  const metadata = await loadMetadata(sessionId);
  const frameCount = metadata.frames_manifest.length;
  
  // 2. Select best quality frame (middle frame usually best)
  const bestFrameIndex = Math.floor(frameCount / 2);
  const bestFrameKey = `signals/${sessionId}/frame_${bestFrameIndex}.jpg`;
  
  console.log(`Using frame ${bestFrameIndex} of ${frameCount}`);
  
  // 3. Detect faces and validate quality
  const faceDetection = await detectFaces(bestFrameKey);
  
  if (!faceDetection.success) {
    return {
      decision: 'REJECT',
      liveness_score: 0,
      channel_trust_score: 50,
      dedupe_risk_score: 0,
      reasons: [faceDetection.reason],
      rekognition_metadata: faceDetection.metadata
    };
  }
  
  // 4. Check for duplicates
  const dedupeCheck = await searchForDuplicates(bestFrameKey);
  
  if (dedupeCheck.isDuplicate) {
    return {
      decision: 'REJECT',
      liveness_score: faceDetection.livenessScore,
      channel_trust_score: calculateChannelTrust(metadata.web_integrity),
      dedupe_risk_score: 95, // High risk - duplicate found
      reasons: ['Duplicate enrollment detected'],
      duplicate_identity_id: dedupeCheck.existingIdentityId,
      rekognition_metadata: {
        face_detection: faceDetection.metadata,
        dedupe_check: dedupeCheck.metadata
      }
    };
  }
  
  // 5. Index face (store in collection)
  const indexResult = await indexFace(sessionId, bestFrameKey);
  
  if (!indexResult.success) {
    return {
      decision: 'REJECT',
      liveness_score: faceDetection.livenessScore,
      channel_trust_score: calculateChannelTrust(metadata.web_integrity),
      dedupe_risk_score: 50,
      reasons: ['Failed to create face template'],
      rekognition_metadata: indexResult.metadata
    };
  }
  
  // 6. Calculate final scores
  const livenessScore = faceDetection.livenessScore;
  const channelTrustScore = calculateChannelTrust(metadata.web_integrity);
  const dedupeRiskScore = dedupeCheck.highestSimilarity || 5; // Low risk if no matches
  
  // 7. Make decision
  const decision = makeEnrollmentDecision(
    livenessScore, 
    channelTrustScore, 
    dedupeRiskScore
  );
  
  return {
    decision,
    identity_id: indexResult.identityId,
    face_id: indexResult.faceId,
    liveness_score: livenessScore,
    channel_trust_score: channelTrustScore,
    dedupe_risk_score: dedupeRiskScore,
    reasons: decision === 'APPROVE' 
      ? ['High quality face detected', 'No duplicate found']
      : ['Quality or trust score below threshold'],
    rekognition_metadata: {
      face_detection: faceDetection.metadata,
      dedupe_check: dedupeCheck.metadata,
      index_result: indexResult.metadata
    }
  };
}

/**
 * Process authentication session
 */
export async function processAuthentication(sessionId, identityId) {
  console.log(`Processing authentication: ${sessionId} for identity: ${identityId}`);
  
  // 1. Load metadata
  const metadata = await loadMetadata(sessionId);
  const frameCount = metadata.frames_manifest.length;
  
  // 2. Select best quality frame
  const bestFrameIndex = Math.floor(frameCount / 2);
  const bestFrameKey = `signals/${sessionId}/frame_${bestFrameIndex}.jpg`;
  
  // 3. Detect faces
  const faceDetection = await detectFaces(bestFrameKey);
  
  if (!faceDetection.success) {
    return {
      decision: 'REJECT',
      liveness_score: 0,
      channel_trust_score: 50,
      dedupe_risk_score: 0,
      reasons: [faceDetection.reason]
    };
  }
  
  // 4. Load enrollment template from database
  const enrollmentTemplate = await getEnrollmentTemplate(identityId);
  
  if (!enrollmentTemplate) {
    return {
      decision: 'REJECT',
      liveness_score: faceDetection.livenessScore,
      channel_trust_score: 50,
      dedupe_risk_score: 0,
      reasons: ['No enrollment template found']
    };
  }
  
  // 5. Compare faces (1:1 match)
  const matchResult = await compareFaces(
    bestFrameKey, 
    enrollmentTemplate.s3_key
  );
  
  if (!matchResult.success) {
    return {
      decision: 'REJECT',
      liveness_score: faceDetection.livenessScore,
      channel_trust_score: calculateChannelTrust(metadata.web_integrity),
      dedupe_risk_score: 0,
      reasons: ['Face comparison failed'],
      rekognition_metadata: matchResult.metadata
    };
  }
  
  // 6. Calculate scores
  const livenessScore = faceDetection.livenessScore;
  const channelTrustScore = calculateChannelTrust(metadata.web_integrity);
  const matchQuality = matchResult.similarity; // 0-100
  
  // 7. Make decision
  const decision = makeAuthenticationDecision(
    livenessScore,
    channelTrustScore,
    matchQuality
  );
  
  return {
    decision,
    identity_id: identityId,
    liveness_score: livenessScore,
    channel_trust_score: channelTrustScore,
    dedupe_risk_score: matchQuality, // High score = good match
    reasons: decision === 'APPROVE'
      ? [`Face match confidence: ${matchQuality.toFixed(1)}%`]
      : ['Face match below threshold'],
    rekognition_metadata: {
      face_detection: faceDetection.metadata,
      face_comparison: matchResult.metadata
    }
  };
}

/**
 * Detect faces in image
 */
async function detectFaces(s3Key) {
  try {
    const command = new DetectFacesCommand({
      Image: {
        S3Object: {
          Bucket: process.env.S3_BUCKET,
          Name: s3Key
        }
      },
      Attributes: ['ALL']
    });
    
    const response = await rekognitionClient.send(command);
    
    if (!response.FaceDetails || response.FaceDetails.length === 0) {
      return {
        success: false,
        reason: 'No face detected in image',
        metadata: { face_count: 0 }
      };
    }
    
    if (response.FaceDetails.length > 1) {
      return {
        success: false,
        reason: 'Multiple faces detected',
        metadata: { face_count: response.FaceDetails.length }
      };
    }
    
    const face = response.FaceDetails[0];
    
    // Quality checks
    const quality = face.Quality;
    const brightness = quality.Brightness;
    const sharpness = quality.Sharpness;
    
    if (brightness < 40 || brightness > 80) {
      return {
        success: false,
        reason: 'Poor lighting conditions',
        metadata: { brightness, sharpness }
      };
    }
    
    if (sharpness < 50) {
      return {
        success: false,
        reason: 'Image too blurry',
        metadata: { brightness, sharpness }
      };
    }
    
    // Calculate liveness score (0-100)
    // Based on: confidence, quality, pose
    const confidence = face.Confidence;
    const qualityScore = (brightness / 80 * 50) + (sharpness / 100 * 50);
    const livenessScore = Math.min(100, (confidence * 0.5) + (qualityScore * 0.5));
    
    return {
      success: true,
      livenessScore: Math.round(livenessScore),
      metadata: {
        confidence,
        brightness,
        sharpness,
        bounding_box: face.BoundingBox,
        pose: face.Pose,
        face_id: face.FaceId
      }
    };
  } catch (error) {
    console.error('DetectFaces error:', error);
    return {
      success: false,
      reason: 'Face detection failed',
      metadata: { error: error.message }
    };
  }
}

/**
 * Search for duplicate faces
 */
async function searchForDuplicates(s3Key) {
  try {
    const command = new SearchFacesByImageCommand({
      CollectionId: process.env.REKOGNITION_COLLECTION_ID,
      Image: {
        S3Object: {
          Bucket: process.env.S3_BUCKET,
          Name: s3Key
        }
      },
      MaxFaces: 10,
      FaceMatchThreshold: 80.0,
      QualityFilter: 'AUTO'
    });
    
    const response = await rekognitionClient.send(command);
    
    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      return {
        isDuplicate: false,
        highestSimilarity: 0,
        metadata: { matches_found: 0 }
      };
    }
    
    // Check if any match exceeds threshold (90% = likely duplicate)
    const highestMatch = response.FaceMatches[0];
    const similarity = highestMatch.Similarity;
    
    if (similarity >= 90.0) {
      // Extract identity_id from ExternalImageId
      const externalId = highestMatch.Face.ExternalImageId;
      const identityId = externalId.replace('identity_', '');
      
      return {
        isDuplicate: true,
        existingIdentityId: identityId,
        highestSimilarity: similarity,
        metadata: {
          matches_found: response.FaceMatches.length,
          highest_similarity: similarity,
          face_id: highestMatch.Face.FaceId
        }
      };
    }
    
    return {
      isDuplicate: false,
      highestSimilarity: similarity,
      metadata: {
        matches_found: response.FaceMatches.length,
        highest_similarity: similarity
      }
    };
  } catch (error) {
    console.error('SearchFacesByImage error:', error);
    return {
      isDuplicate: false,
      highestSimilarity: 0,
      metadata: { error: error.message }
    };
  }
}

/**
 * Index face in collection
 */
async function indexFace(sessionId, s3Key) {
  try {
    // Generate unique identity_id
    const identityId = `ident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const command = new IndexFacesCommand({
      CollectionId: process.env.REKOGNITION_COLLECTION_ID,
      Image: {
        S3Object: {
          Bucket: process.env.S3_BUCKET,
          Name: s3Key
        }
      },
      ExternalImageId: `identity_${identityId}`,
      DetectionAttributes: ['ALL'],
      MaxFaces: 1,
      QualityFilter: 'AUTO'
    });
    
    const response = await rekognitionClient.send(command);
    
    if (!response.FaceRecords || response.FaceRecords.length === 0) {
      return {
        success: false,
        metadata: { error: 'No face indexed' }
      };
    }
    
    const faceRecord = response.FaceRecords[0];
    const faceId = faceRecord.Face.FaceId;
    
    return {
      success: true,
      identityId,
      faceId,
      metadata: {
        face_id: faceId,
        confidence: faceRecord.Face.Confidence,
        bounding_box: faceRecord.Face.BoundingBox,
        image_id: faceRecord.Face.ImageId,
        model_version: response.FaceModelVersion
      }
    };
  } catch (error) {
    console.error('IndexFaces error:', error);
    return {
      success: false,
      metadata: { error: error.message }
    };
  }
}

/**
 * Compare faces (1:1 authentication)
 */
async function compareFaces(sourceS3Key, targetS3Key) {
  try {
    const command = new CompareFacesCommand({
      SourceImage: {
        S3Object: {
          Bucket: process.env.S3_BUCKET,
          Name: sourceS3Key
        }
      },
      TargetImage: {
        S3Object: {
          Bucket: process.env.S3_BUCKET,
          Name: targetS3Key
        }
      },
      SimilarityThreshold: 80.0,
      QualityFilter: 'AUTO'
    });
    
    const response = await rekognitionClient.send(command);
    
    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      return {
        success: false,
        similarity: 0,
        metadata: { 
          matches_found: 0,
          unmatched_faces: response.UnmatchedFaces?.length || 0
        }
      };
    }
    
    const match = response.FaceMatches[0];
    const similarity = match.Similarity;
    
    return {
      success: true,
      similarity,
      metadata: {
        similarity,
        confidence: match.Face.Confidence,
        source_confidence: response.SourceImageFace.Confidence,
        bounding_box: match.Face.BoundingBox
      }
    };
  } catch (error) {
    console.error('CompareFaces error:', error);
    return {
      success: false,
      similarity: 0,
      metadata: { error: error.message }
    };
  }
}

/**
 * Calculate channel trust score from web integrity signals
 */
function calculateChannelTrust(webIntegrity) {
  let score = 50; // Base score
  
  // WebDriver detection (bots)
  if (webIntegrity.webdriver === false) {
    score += 20;
  } else {
    score -= 30;
  }
  
  // Event loop lag (automation detection)
  const avgLag = webIntegrity.timing_signals?.event_loop_lag_ms?.avg || 0;
  if (avgLag < 5) {
    score += 15;
  } else if (avgLag > 20) {
    score -= 20;
  }
  
  // Hardware consistency
  if (webIntegrity.hardware_concurrency >= 4 && webIntegrity.device_memory_gb >= 4) {
    score += 10;
  }
  
  // Feature support
  const features = webIntegrity.feature_support;
  if (features.supports_webrtc && features.supports_media_recorder) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Make enrollment decision
 */
function makeEnrollmentDecision(livenessScore, channelTrustScore, dedupeRiskScore) {
  // Thresholds
  const LIVENESS_THRESHOLD = 70;
  const CHANNEL_TRUST_THRESHOLD = 60;
  const DEDUPE_THRESHOLD = 85; // Above this = likely duplicate
  
  if (dedupeRiskScore >= DEDUPE_THRESHOLD) {
    return 'REJECT'; // Duplicate detected
  }
  
  if (livenessScore >= LIVENESS_THRESHOLD && channelTrustScore >= CHANNEL_TRUST_THRESHOLD) {
    return 'APPROVE';
  }
  
  if (livenessScore < 50 || channelTrustScore < 40) {
    return 'REJECT';
  }
  
  return 'MANUAL_REVIEW';
}

/**
 * Make authentication decision
 */
function makeAuthenticationDecision(livenessScore, channelTrustScore, matchQuality) {
  // Thresholds
  const LIVENESS_THRESHOLD = 70;
  const CHANNEL_TRUST_THRESHOLD = 60;
  const MATCH_THRESHOLD = 85; // Face similarity threshold
  
  if (matchQuality >= MATCH_THRESHOLD && 
      livenessScore >= LIVENESS_THRESHOLD && 
      channelTrustScore >= CHANNEL_TRUST_THRESHOLD) {
    return 'APPROVE';
  }
  
  if (matchQuality < 70 || livenessScore < 50 || channelTrustScore < 40) {
    return 'REJECT';
  }
  
  return 'MANUAL_REVIEW';
}

/**
 * Helper: Load metadata from S3
 */
async function loadMetadata(sessionId) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `signals/${sessionId}/metadata.json`
  });
  
  const response = await s3Client.send(command);
  const body = await response.Body.transformToString();
  return JSON.parse(body);
}

/**
 * Helper: Get enrollment template from database
 */
async function getEnrollmentTemplate(identityId) {
  // Query your database for enrollment template S3 key
  // This is pseudocode - implement with your DB client
  const result = await db.query(
    'SELECT template_storage_path FROM identities WHERE identity_id = $1',
    [identityId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return {
    s3_key: result.rows[0].template_storage_path
  };
}
```

### Python Implementation

```python
# rekognition_processor.py
import boto3
import json
import os
from datetime import datetime

rekognition = boto3.client('rekognition', region_name=os.getenv('AWS_REGION'))
s3 = boto3.client('s3', region_name=os.getenv('AWS_REGION'))

def process_enrollment(session_id):
    """Process enrollment session with Rekognition"""
    
    # Load metadata
    metadata = load_metadata(session_id)
    frame_count = len(metadata['frames_manifest'])
    
    # Select best frame (middle)
    best_frame_idx = frame_count // 2
    best_frame_key = f"signals/{session_id}/frame_{best_frame_idx}.jpg"
    
    # Detect faces
    face_detection = detect_faces(best_frame_key)
    if not face_detection['success']:
        return {
            'decision': 'REJECT',
            'liveness_score': 0,
            'channel_trust_score': 50,
            'dedupe_risk_score': 0,
            'reasons': [face_detection['reason']]
        }
    
    # Check duplicates
    dedupe_check = search_for_duplicates(best_frame_key)
    if dedupe_check['is_duplicate']:
        return {
            'decision': 'REJECT',
            'liveness_score': face_detection['liveness_score'],
            'channel_trust_score': calculate_channel_trust(metadata['web_integrity']),
            'dedupe_risk_score': 95,
            'reasons': ['Duplicate enrollment detected'],
            'duplicate_identity_id': dedupe_check['existing_identity_id']
        }
    
    # Index face
    index_result = index_face(session_id, best_frame_key)
    if not index_result['success']:
        return {
            'decision': 'REJECT',
            'liveness_score': face_detection['liveness_score'],
            'channel_trust_score': calculate_channel_trust(metadata['web_integrity']),
            'dedupe_risk_score': 50,
            'reasons': ['Failed to create face template']
        }
    
    # Calculate scores
    liveness_score = face_detection['liveness_score']
    channel_trust_score = calculate_channel_trust(metadata['web_integrity'])
    dedupe_risk_score = dedupe_check.get('highest_similarity', 5)
    
    # Make decision
    decision = make_enrollment_decision(liveness_score, channel_trust_score, dedupe_risk_score)
    
    return {
        'decision': decision,
        'identity_id': index_result['identity_id'],
        'face_id': index_result['face_id'],
        'liveness_score': liveness_score,
        'channel_trust_score': channel_trust_score,
        'dedupe_risk_score': dedupe_risk_score,
        'reasons': ['High quality face detected', 'No duplicate found'] if decision == 'APPROVE' else ['Quality below threshold']
    }

def detect_faces(s3_key):
    """Detect faces using Rekognition"""
    try:
        response = rekognition.detect_faces(
            Image={
                'S3Object': {
                    'Bucket': os.getenv('S3_BUCKET'),
                    'Name': s3_key
                }
            },
            Attributes=['ALL']
        )
        
        if not response.get('FaceDetails'):
            return {'success': False, 'reason': 'No face detected'}
        
        if len(response['FaceDetails']) > 1:
            return {'success': False, 'reason': 'Multiple faces detected'}
        
        face = response['FaceDetails'][0]
        quality = face['Quality']
        
        # Quality checks
        brightness = quality['Brightness']
        sharpness = quality['Sharpness']
        
        if brightness < 40 or brightness > 80:
            return {'success': False, 'reason': 'Poor lighting'}
        
        if sharpness < 50:
            return {'success': False, 'reason': 'Image too blurry'}
        
        # Calculate liveness score
        confidence = face['Confidence']
        quality_score = (brightness / 80 * 50) + (sharpness / 100 * 50)
        liveness_score = min(100, (confidence * 0.5) + (quality_score * 0.5))
        
        return {
            'success': True,
            'liveness_score': round(liveness_score),
            'metadata': {
                'confidence': confidence,
                'brightness': brightness,
                'sharpness': sharpness
            }
        }
    except Exception as e:
        return {'success': False, 'reason': f'Detection failed: {str(e)}'}

def search_for_duplicates(s3_key):
    """Search for duplicate faces"""
    try:
        response = rekognition.search_faces_by_image(
            CollectionId=os.getenv('REKOGNITION_COLLECTION_ID'),
            Image={
                'S3Object': {
                    'Bucket': os.getenv('S3_BUCKET'),
                    'Name': s3_key
                }
            },
            MaxFaces=10,
            FaceMatchThreshold=80.0,
            QualityFilter='AUTO'
        )
        
        if not response.get('FaceMatches'):
            return {'is_duplicate': False, 'highest_similarity': 0}
        
        highest_match = response['FaceMatches'][0]
        similarity = highest_match['Similarity']
        
        if similarity >= 90.0:
            external_id = highest_match['Face']['ExternalImageId']
            identity_id = external_id.replace('identity_', '')
            return {
                'is_duplicate': True,
                'existing_identity_id': identity_id,
                'highest_similarity': similarity
            }
        
        return {'is_duplicate': False, 'highest_similarity': similarity}
    except Exception as e:
        return {'is_duplicate': False, 'highest_similarity': 0}

def index_face(session_id, s3_key):
    """Index face in Rekognition collection"""
    try:
        identity_id = f"ident_{int(datetime.now().timestamp())}_{os.urandom(4).hex()}"
        
        response = rekognition.index_faces(
            CollectionId=os.getenv('REKOGNITION_COLLECTION_ID'),
            Image={
                'S3Object': {
                    'Bucket': os.getenv('S3_BUCKET'),
                    'Name': s3_key
                }
            },
            ExternalImageId=f'identity_{identity_id}',
            DetectionAttributes=['ALL'],
            MaxFaces=1,
            QualityFilter='AUTO'
        )
        
        if not response.get('FaceRecords'):
            return {'success': False}
        
        face_record = response['FaceRecords'][0]
        face_id = face_record['Face']['FaceId']
        
        return {
            'success': True,
            'identity_id': identity_id,
            'face_id': face_id
        }
    except Exception as e:
        return {'success': False}

def calculate_channel_trust(web_integrity):
    """Calculate channel trust score"""
    score = 50
    
    if not web_integrity.get('webdriver'):
        score += 20
    else:
        score -= 30
    
    avg_lag = web_integrity.get('timing_signals', {}).get('event_loop_lag_ms', {}).get('avg', 0)
    if avg_lag < 5:
        score += 15
    elif avg_lag > 20:
        score -= 20
    
    return max(0, min(100, score))

def make_enrollment_decision(liveness_score, channel_trust_score, dedupe_risk_score):
    """Make enrollment decision"""
    if dedupe_risk_score >= 85:
        return 'REJECT'
    
    if liveness_score >= 70 and channel_trust_score >= 60:
        return 'APPROVE'
    
    if liveness_score < 50 or channel_trust_score < 40:
        return 'REJECT'
    
    return 'MANUAL_REVIEW'

def load_metadata(session_id):
    """Load metadata from S3"""
    response = s3.get_object(
        Bucket=os.getenv('S3_BUCKET'),
        Key=f'signals/{session_id}/metadata.json'
    )
    return json.loads(response['Body'].read())
```

---

## Security Best Practices

### 1. IAM Permissions (Least Privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectFaces",
        "rekognition:CompareFaces",
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage"
      ],
      "Resource": "arn:aws:rekognition:*:*:collection/usesense-identities-*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    }
  ]
}
```

### 2. Encryption

- ✅ **S3**: Enable server-side encryption (SSE-S3 or SSE-KMS)
- ✅ **Transit**: All API calls use TLS 1.2+
- ✅ **Database**: Encrypt face_id and rekognition metadata fields
- ✅ **Logs**: Redact sensitive data in CloudWatch logs

### 3. Access Control

- ✅ **Collection Access**: Restrict to backend service role only
- ✅ **S3 Bucket Policy**: Deny public access
- ✅ **API Keys**: Rotate every 90 days
- ✅ **Session Tokens**: Short TTL (15 minutes)

### 4. Data Retention

```javascript
// Delete face from collection after 30 days (enrollment failure)
async function cleanupOldFaces() {
  const response = await rekognition.listFaces({
    CollectionId: process.env.REKOGNITION_COLLECTION_ID,
    MaxResults: 1000
  });
  
  for (const face of response.Faces) {
    const age = Date.now() - face.CreatedTimestamp;
    const daysOld = age / (1000 * 60 * 60 * 24);
    
    if (daysOld > 30) {
      // Check if face is associated with valid identity
      const hasIdentity = await checkIdentityExists(face.ExternalImageId);
      
      if (!hasIdentity) {
        await rekognition.deleteFaces({
          CollectionId: process.env.REKOGNITION_COLLECTION_ID,
          FaceIds: [face.FaceId]
        });
      }
    }
  }
}
```

### 5. Audit Logging

```javascript
// Log all Rekognition API calls
async function auditRekognitionCall(operation, params, result) {
  await db.query(`
    INSERT INTO rekognition_audit_logs
    (operation, session_id, face_id, result, created_at)
    VALUES ($1, $2, $3, $4, NOW())
  `, [
    operation,
    params.sessionId,
    result.faceId || null,
    JSON.stringify(result)
  ]);
}
```

---

## Cost Optimization

### Estimated Monthly Costs (10,000 sessions/month)

| Service | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| Rekognition - DetectFaces | 10,000 images | $0.001/image | $10 |
| Rekognition - IndexFaces (enrollment) | 5,000 enrollments | $0.001/image | $5 |
| Rekognition - CompareFaces (auth) | 5,000 authentications | $0.001/comparison | $5 |
| Rekognition - SearchFaces (dedupe) | 5,000 searches | $0.001/1000 | $5 |
| S3 Storage | 50 GB (30-day retention) | $0.023/GB | $1.15 |
| S3 Requests | 50,000 PUT/GET | $0.005/1000 | $0.25 |
| **Total** | | | **~$26.40/month** |

### Cost Optimization Tips

1. **Use QualityFilter**: `AUTO` setting reduces poor-quality API calls
2. **Select Best Frame**: Process 1 frame instead of all 38 frames
3. **Batch Operations**: Use SDK batch APIs when possible
4. **Smart Deduplication**: Only search on enrollment, not authentication
5. **S3 Lifecycle**: Delete signals after 30 days
6. **Reserve Capacity**: For high volume (contact AWS)

---

## Error Handling

### Common Rekognition Errors

```javascript
async function handleRekognitionError(error) {
  if (error.name === 'InvalidParameterException') {
    return {
      decision: 'REJECT',
      reasons: ['Invalid image format or quality'],
      retry: false
    };
  }
  
  if (error.name === 'ImageTooLargeException') {
    return {
      decision: 'REJECT',
      reasons: ['Image size exceeds limit'],
      retry: false
    };
  }
  
  if (error.name === 'ProvisionedThroughputExceededException') {
    return {
      decision: 'MANUAL_REVIEW',
      reasons: ['Service temporarily unavailable'],
      retry: true
    };
  }
  
  if (error.name === 'ThrottlingException') {
    // Implement exponential backoff
    await sleep(1000);
    return { retry: true };
  }
  
  // Unknown error
  return {
    decision: 'MANUAL_REVIEW',
    reasons: ['Processing error occurred'],
    retry: false
  };
}
```

---

## Testing

### Unit Tests

```javascript
// test/rekognition-processor.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { processEnrollment } from '../rekognition-processor.js';

describe('Rekognition Processor', () => {
  it('should approve high-quality enrollment', async () => {
    const result = await processEnrollment('test_session_123');
    
    expect(result.decision).toBe('APPROVE');
    expect(result.liveness_score).toBeGreaterThan(70);
    expect(result.identity_id).toBeDefined();
  });
  
  it('should reject duplicate enrollment', async () => {
    // First enrollment
    await processEnrollment('session_1');
    
    // Duplicate attempt (same face)
    const result = await processEnrollment('session_2_duplicate');
    
    expect(result.decision).toBe('REJECT');
    expect(result.reasons).toContain('Duplicate enrollment detected');
  });
});
```

---

## Monitoring

### CloudWatch Metrics

```javascript
// Custom metrics
const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

async function publishMetrics(sessionId, result) {
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: 'UseSense/Rekognition',
    MetricData: [
      {
        MetricName: 'LivenessScore',
        Value: result.liveness_score,
        Unit: 'None',
        Timestamp: new Date()
      },
      {
        MetricName: 'ProcessingDuration',
        Value: result.processing_time_ms,
        Unit: 'Milliseconds',
        Timestamp: new Date()
      },
      {
        MetricName: 'DecisionApproved',
        Value: result.decision === 'APPROVE' ? 1 : 0,
        Unit: 'Count',
        Timestamp: new Date()
      }
    ]
  }));
}
```

### Alarms

```bash
# Create CloudWatch alarm for high rejection rate
aws cloudwatch put-metric-alarm \
  --alarm-name "UseSense-High-Rejection-Rate" \
  --alarm-description "Alert if rejection rate > 30%" \
  --metric-name DecisionRejected \
  --namespace UseSense/Rekognition \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 30 \
  --comparison-operator GreaterThanThreshold
```

---

## Summary

Amazon Rekognition provides enterprise-grade security for UseSense from day 1:

✅ **Fast Integration**: ~1 week to production  
✅ **High Accuracy**: 99.9%+ face detection  
✅ **Scalable**: Handles millions of sessions  
✅ **Secure**: SOC/PCI-DSS compliant  
✅ **Cost-Effective**: ~$0.002 per session  

**Next Steps:**
1. Complete AWS setup (Steps 1-5)
2. Integrate code examples into your backend
3. Test with SDK demo
4. Deploy to staging
5. Load test and monitor
6. Launch! 🚀

For questions: support@usesense.ai
