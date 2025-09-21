#!/bin/bash

# Flibusta Session Management Testing Script
# Tests the Node.js backend session functionality

BASE_URL="http://localhost:27100"
COOKIE_FILE="test_session_cookies.txt"
BOOK_ID="98266"

echo "🧪 Testing Flibusta Session Management System"
echo "============================================="

# Clean up previous session
rm -f $COOKIE_FILE

echo ""
echo "1️⃣ Testing session initialization..."
SESSION_INFO=$(curl -s -c $COOKIE_FILE "$BASE_URL/api/session/me")
echo "Session created: $SESSION_INFO" | jq .

echo ""
echo "2️⃣ Testing user stats (initial)..."
STATS=$(curl -s -b $COOKIE_FILE "$BASE_URL/api/session/stats")
echo "Initial stats: $STATS" | jq .

echo ""
echo "3️⃣ Testing adding book to favorites..."
ADD_FAV=$(curl -s -b $COOKIE_FILE -X POST "$BASE_URL/api/session/favorites/$BOOK_ID")
echo "Add favorite result: $ADD_FAV" | jq .

echo ""
echo "4️⃣ Testing favorite status check..."
FAV_STATUS=$(curl -s -b $COOKIE_FILE "$BASE_URL/api/session/favorites/$BOOK_ID/status")
echo "Favorite status: $FAV_STATUS" | jq .

echo ""
echo "5️⃣ Testing reading progress save..."
PROGRESS_SAVE=$(curl -s -b $COOKIE_FILE -X POST "$BASE_URL/api/session/progress/$BOOK_ID" \
  -H "Content-Type: application/json" -d '{"position": 33.3}')
echo "Progress save result: $PROGRESS_SAVE" | jq .

echo ""
echo "6️⃣ Testing getting user favorites..."
FAVORITES=$(curl -s -b $COOKIE_FILE "$BASE_URL/api/session/favorites")
echo "User favorites:" 
echo "$FAVORITES" | jq '.favorites[] | {title: .title, authors: .authors, year: .year}'

echo ""
echo "7️⃣ Testing getting reading progress..."
PROGRESS=$(curl -s -b $COOKIE_FILE "$BASE_URL/api/session/progress")
echo "Reading progress:"
echo "$PROGRESS" | jq '.progress[] | {title: .title, progress: .pos, authors: .authors}'

echo ""
echo "8️⃣ Testing updated user stats..."
FINAL_STATS=$(curl -s -b $COOKIE_FILE "$BASE_URL/api/session/stats")
echo "Final stats: $FINAL_STATS" | jq .

echo ""
echo "9️⃣ Testing anonymous user name update..."
NAME_UPDATE=$(curl -s -b $COOKIE_FILE -X PUT "$BASE_URL/api/session/name" \
  -H "Content-Type: application/json" -d '{"name": "TestUser123"}')
echo "Name update result: $NAME_UPDATE" | jq .

echo ""
echo "🔟 Testing updated session info..."
UPDATED_SESSION=$(curl -s -b $COOKIE_FILE "$BASE_URL/api/session/me")
echo "Updated session: $UPDATED_SESSION" | jq .

echo ""
echo "♻️ Testing favorite removal..."
REMOVE_FAV=$(curl -s -b $COOKIE_FILE -X DELETE "$BASE_URL/api/session/favorites/$BOOK_ID")
echo "Remove favorite result: $REMOVE_FAV" | jq .

echo ""
echo "📊 Testing final stats after removal..."
END_STATS=$(curl -s -b $COOKIE_FILE "$BASE_URL/api/session/stats")
echo "End stats: $END_STATS" | jq .

echo ""
echo "✅ Session management testing completed!"
echo "📁 Session cookies saved in: $COOKIE_FILE"

# Clean up
rm -f $COOKIE_FILE