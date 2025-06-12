#!/bin/bash
# Docker Environment Management Script for FastAPI RBAC
# This script helps manage different Docker environments with proper separation

set -e

# Color functions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_colored() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Script usage
usage() {
    echo "Usage: $0 <environment> <action> [options]"
    echo ""
    echo "Environments:"
    echo "  dev        Development environment (hot-reload, debug)"
    echo "  test       Testing environment (CI/CD, integration tests)"
    echo "  prod-test  Production testing environment (prod-like settings)"
    echo "  prod       Production environment (secure, optimized)"
    echo ""
    echo "Actions:"
    echo "  up         Start the environment"
    echo "  down       Stop the environment"
    echo "  restart    Restart the environment"
    echo "  logs       Show logs"
    echo "  status     Show status and port mappings"
    echo "  clean      Clean up environment (remove containers, volumes, images)"
    echo ""
    echo "Options:"
    echo "  -d, --detached    Run in detached mode"
    echo "  -b, --build       Force build images"
    echo "  -v, --verbose     Verbose output"
    echo "  -h, --help        Show this help"
    exit 1
}

# Parse arguments
ENVIRONMENT=""
ACTION=""
DETACHED=false
BUILD=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        dev|test|prod-test|prod)
            ENVIRONMENT="$1"
            shift
            ;;
        up|down|restart|logs|status|clean)
            ACTION="$1"
            shift
            ;;
        -d|--detached)
            DETACHED=true
            shift
            ;;
        -b|--build)
            BUILD=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [[ -z "$ENVIRONMENT" ]] || [[ -z "$ACTION" ]]; then
    echo "Error: Environment and action are required"
    usage
fi

# Environment configurations
declare -A ENV_CONFIGS

# Development environment
ENV_CONFIGS[dev_files]="docker-compose.dev.yml"
ENV_CONFIGS[dev_network]="fastapi_rbac_dev_network"
ENV_CONFIGS[dev_description]="Development Environment (Hot-reload, Debug mode)"
ENV_CONFIGS[dev_backend_port]="8000"
ENV_CONFIGS[dev_frontend_port]="3000"
ENV_CONFIGS[dev_db_port]="5433"
ENV_CONFIGS[dev_redis_port]="6379"
ENV_CONFIGS[dev_pgadmin_port]="8080"
ENV_CONFIGS[dev_mailhog_port]="8025"
ENV_CONFIGS[dev_flower_port]="5555"

# Testing environment
ENV_CONFIGS[test_files]="docker-compose.yml"
ENV_CONFIGS[test_network]="fastapi_rbac_test_network"
ENV_CONFIGS[test_description]="Testing Environment (CI/CD, Integration tests)"
ENV_CONFIGS[test_backend_port]="8002"
ENV_CONFIGS[test_frontend_port]="3001"
ENV_CONFIGS[test_db_port]="5435"
ENV_CONFIGS[test_redis_port]="6381"
ENV_CONFIGS[test_mailhog_port]="8027"
ENV_CONFIGS[test_flower_port]="5556"

# Production testing environment
ENV_CONFIGS[prod-test_files]="docker-compose.prod-test.yml"
ENV_CONFIGS[prod-test_network]="fastapi_rbac_prod_test_network"
ENV_CONFIGS[prod-test_description]="Production Testing Environment (Production-like settings)"
ENV_CONFIGS[prod-test_backend_port]="8001"
ENV_CONFIGS[prod-test_frontend_port]="81"
ENV_CONFIGS[prod-test_db_port]="5434"
ENV_CONFIGS[prod-test_redis_port]="6380"
ENV_CONFIGS[prod-test_pgadmin_port]="8081"
ENV_CONFIGS[prod-test_mailhog_port]="8026"

# Production environment
ENV_CONFIGS[prod_files]="backend/docker-compose.prod.yml react-frontend/docker-compose.prod.yml"
ENV_CONFIGS[prod_network]="fastapi_rbac_network"
ENV_CONFIGS[prod_description]="Production Environment (Secure, Optimized)"
ENV_CONFIGS[prod_backend_port]="8000"
ENV_CONFIGS[prod_frontend_port]="80"
ENV_CONFIGS[prod_db_port]="5432"
ENV_CONFIGS[prod_redis_port]="6379"
ENV_CONFIGS[prod_pgadmin_port]="5050"

# Get environment configuration
get_config() {
    local key="${ENVIRONMENT}_${1}"
    echo "${ENV_CONFIGS[$key]}"
}

# Verbose logging
log_verbose() {
    if [[ "$VERBOSE" == true ]]; then
        print_colored $BLUE "Executing: $1"
    fi
}

# Build docker-compose command
build_compose_command() {
    local files=$(get_config "files")
    local cmd="docker-compose"

    for file in $files; do
        cmd="$cmd -f $file"
    done

    echo "$cmd"
}

# Execute docker-compose command
execute_compose() {
    local compose_cmd=$(build_compose_command)
    local full_cmd="$compose_cmd $@"

    log_verbose "$full_cmd"
    eval "$full_cmd"
}

# Ensure network exists
ensure_network() {
    local network=$(get_config "network")

    if ! docker network ls --format "{{.Name}}" | grep -q "^${network}$"; then
        print_colored $YELLOW "Creating network: $network"
        docker network create "$network"
    else
        print_colored $GREEN "Network exists: $network"
    fi
}

# Show port information
show_port_info() {
    print_colored $BLUE "Port mappings for $ENVIRONMENT environment:"

    local backend_port=$(get_config "backend_port")
    local frontend_port=$(get_config "frontend_port")
    local db_port=$(get_config "db_port")
    local redis_port=$(get_config "redis_port")
    local pgadmin_port=$(get_config "pgadmin_port")
    local mailhog_port=$(get_config "mailhog_port")
    local flower_port=$(get_config "flower_port")

    [[ -n "$backend_port" ]] && echo "  backend: localhost:$backend_port"
    [[ -n "$frontend_port" ]] && echo "  frontend: localhost:$frontend_port"
    [[ -n "$db_port" ]] && echo "  database: localhost:$db_port"
    [[ -n "$redis_port" ]] && echo "  redis: localhost:$redis_port"
    [[ -n "$pgadmin_port" ]] && echo "  pgadmin: localhost:$pgadmin_port"
    [[ -n "$mailhog_port" ]] && echo "  mailhog: localhost:$mailhog_port"
    [[ -n "$flower_port" ]] && echo "  flower: localhost:$flower_port"
    echo
}

# Main script execution
print_colored $BLUE "=== FastAPI RBAC Environment Manager ==="
print_colored $GREEN "Environment: $ENVIRONMENT"
print_colored $YELLOW "Description: $(get_config 'description')"
print_colored $GREEN "Action: $ACTION"
echo

case $ACTION in
    "up")
        ensure_network
        show_port_info

        local up_args="up"
        [[ "$DETACHED" == true ]] && up_args="$up_args --detach"
        [[ "$BUILD" == true ]] && up_args="$up_args --build"

        print_colored $GREEN "Starting $ENVIRONMENT environment..."
        execute_compose $up_args

        if [[ $? -eq 0 ]]; then
            print_colored $GREEN "Environment started successfully!"
            print_colored $BLUE "Access the application at:"

            local frontend_port=$(get_config "frontend_port")
            local backend_port=$(get_config "backend_port")
            local pgadmin_port=$(get_config "pgadmin_port")
            local mailhog_port=$(get_config "mailhog_port")
            local flower_port=$(get_config "flower_port")

            [[ -n "$frontend_port" ]] && echo "  Frontend: http://localhost:$frontend_port"
            [[ -n "$backend_port" ]] && echo "  Backend API: http://localhost:$backend_port"
            [[ -n "$pgadmin_port" ]] && echo "  PgAdmin: http://localhost:$pgadmin_port"
            [[ -n "$mailhog_port" ]] && echo "  MailHog: http://localhost:$mailhog_port"
            [[ -n "$flower_port" ]] && echo "  Flower: http://localhost:$flower_port"
        else
            print_colored $RED "Failed to start environment!"
            exit 1
        fi
        ;;

    "down")
        print_colored $YELLOW "Stopping $ENVIRONMENT environment..."
        execute_compose down

        if [[ $? -eq 0 ]]; then
            print_colored $GREEN "Environment stopped successfully!"
        else
            print_colored $RED "Failed to stop environment!"
            exit 1
        fi
        ;;

    "restart")
        print_colored $YELLOW "Restarting $ENVIRONMENT environment..."
        execute_compose restart

        if [[ $? -eq 0 ]]; then
            print_colored $GREEN "Environment restarted successfully!"
        else
            print_colored $RED "Failed to restart environment!"
            exit 1
        fi
        ;;

    "logs")
        local logs_args="logs"
        [[ "$DETACHED" != true ]] && logs_args="$logs_args -f"

        print_colored $BLUE "Showing logs for $ENVIRONMENT environment..."
        execute_compose $logs_args
        ;;

    "status")
        print_colored $BLUE "Status for $ENVIRONMENT environment:"
        execute_compose ps

        echo
        show_port_info

        print_colored $BLUE "Health status:"
        local network=$(get_config "network")
        local containers=$(docker ps --filter "network=$network" --format "{{.Names}}" 2>/dev/null || echo "")

        for container in $containers; do
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "")
            if [[ -n "$health" ]]; then
                if [[ "$health" == "healthy" ]]; then
                    print_colored $GREEN "  $container: $health"
                else
                    print_colored $RED "  $container: $health"
                fi
            else
                print_colored $YELLOW "  $container: running (no health check)"
            fi
        done
        ;;

    "clean")
        print_colored $YELLOW "Cleaning up $ENVIRONMENT environment..."

        # Stop and remove containers
        execute_compose down --volumes --remove-orphans

        # Remove environment-specific volumes
        local volumes=$(docker volume ls --format "{{.Name}}" | grep -E ".*${ENVIRONMENT}.*|.*${ENVIRONMENT}_.*" || echo "")
        if [[ -n "$volumes" ]]; then
            print_colored $YELLOW "Removing environment-specific volumes..."
            for volume in $volumes; do
                docker volume rm "$volume" 2>/dev/null || true
                echo "  Removed volume: $volume"
            done
        fi

        # Clean up unused images for this environment
        local images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep ":${ENVIRONMENT}$" || echo "")
        if [[ -n "$images" ]]; then
            print_colored $YELLOW "Removing environment-specific images..."
            for image in $images; do
                docker rmi "$image" 2>/dev/null || true
                echo "  Removed image: $image"
            done
        fi

        print_colored $GREEN "Environment cleaned successfully!"
        ;;

    *)
        echo "Unknown action: $ACTION"
        usage
        ;;
esac

print_colored $BLUE "\n=== Operation completed ==="
