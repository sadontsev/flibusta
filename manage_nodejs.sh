#!/bin/bash

# Node.js Management Script Wrapper
# This script provides a shell interface to the Node.js management system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js management script exists
MANAGE_SCRIPT="backend/src/scripts/manage.js"
if [ ! -f "$MANAGE_SCRIPT" ]; then
    print_error "Management script not found: $MANAGE_SCRIPT"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Function to run management command in Docker container
run_manage_command() {
    local command="$1"
    print_status "Running: npm run manage $command"
    
    # Check if backend container is running
    if ! docker ps | grep -q "flibusta-backend"; then
        print_warning "Backend container not running, starting it..."
        docker-compose up -d backend
        sleep 5
    fi
    
    # Run the command in the container
    docker exec -it flibusta-backend-1 npm run manage $command
}

# Function to run management command via API
run_api_command() {
    local endpoint="$1"
    local method="${2:-GET}"
    local auth_token="${FLIBUSTA_ADMIN_TOKEN:-development-token}"
    
    print_status "Calling API: $method /api/admin/$endpoint"
    
    local api_url="http://localhost:27102/api/admin/$endpoint"
    local curl_args=("-X" "$method" "-H" "Authorization: Bearer $auth_token" "-H" "Content-Type: application/json")
    
    if [ "$method" = "POST" ]; then
        curl_args+=("-d" "{}")
    fi
    
    curl -s "${curl_args[@]}" "$api_url" | jq '.' || {
        print_error "API call failed or jq not available"
        return 1
    }
}

# Show help
show_help() {
    echo "Node.js Flibusta Management System"
    echo "=================================="
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "DATABASE COMMANDS:"
    echo "  stats                    Show database statistics"
    echo "  health                   Perform database health check"
    echo "  download-sql             Download SQL files from flibusta.is"
    echo "  download-covers          Download cover and author image files"
    echo "  update-daily             Download daily book updates"
    echo "  update-zip-mappings      Scan and update ZIP file mappings"
    echo "  update-search-vectors    Update full-text search vectors"
    echo "  create-missing-filenames Create missing filename entries"
    echo "  full-setup               Perform complete setup"
    echo ""
    echo "SCHEDULER COMMANDS:"
    echo "  scheduler-start          Start automated maintenance scheduler"
    echo "  scheduler-stop           Stop automated maintenance scheduler"
    echo "  scheduler-status         Show scheduler status"
    echo "  scheduler-run <task>     Manually run a specific task"
    echo ""
    echo "API COMMANDS (alternative to direct container commands):"
    echo "  api-stats                Get stats via API"
    echo "  api-health               Get health via API"
    echo "  api-full-setup           Run full setup via API"
    echo ""
    echo "DOCKER INTEGRATION:"
    echo "  docker-status            Show Docker container status"
    echo "  docker-logs              Show backend container logs"
    echo "  docker-restart           Restart backend container"
    echo ""
    echo "Examples:"
    echo "  $0 stats                 # Show database statistics"
    echo "  $0 health                # Check database health"
    echo "  $0 update-daily          # Download daily updates"
    echo "  $0 full-setup            # Complete system setup"
    echo "  $0 scheduler-start       # Start automated maintenance"
    echo ""
}

# Main command processing
case "${1:-help}" in
    # Database commands (via Node.js container)
    "stats")
        run_manage_command "stats"
        ;;
    "health")
        run_manage_command "health"
        ;;
    "download-sql")
        run_manage_command "download-sql"
        ;;
    "download-covers")
        run_manage_command "download-covers"
        ;;
    "update-daily")
        run_manage_command "update-daily"
        ;;
    "update-zip-mappings")
        run_manage_command "update-zip-mappings"
        ;;
    "update-search-vectors")
        run_manage_command "update-search-vectors"
        ;;
    "create-missing-filenames")
        run_manage_command "create-missing-filenames"
        ;;
    "full-setup")
        run_manage_command "full-setup"
        ;;
    
    # API commands
    "api-stats")
        run_api_command "stats" "GET"
        ;;
    "api-health")
        run_api_command "health" "GET"
        ;;
    "api-full-setup")
        print_warning "This is a long-running operation..."
        run_api_command "full-setup" "POST"
        ;;
    
    # Scheduler commands
    "scheduler-start")
        run_api_command "scheduler/start" "POST"
        ;;
    "scheduler-stop")
        run_api_command "scheduler/stop" "POST"
        ;;
    "scheduler-status")
        run_api_command "scheduler/status" "GET"
        ;;
    "scheduler-run")
        if [ -z "$2" ]; then
            print_error "Task name required. Usage: $0 scheduler-run <task>"
            exit 1
        fi
        run_api_command "scheduler/run/$2" "POST"
        ;;
    
    # Docker integration commands
    "docker-status")
        print_status "Docker container status:"
        docker ps | grep flibusta || print_warning "No flibusta containers running"
        ;;
    "docker-logs")
        print_status "Backend container logs:"
        docker logs -f flibusta-backend-1
        ;;
    "docker-restart")
        print_status "Restarting backend container..."
        docker-compose restart backend
        print_success "Backend container restarted"
        ;;
    
    # Help and unknown commands
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac