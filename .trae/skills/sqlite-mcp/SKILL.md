---
name: "sqlite-mcp"
description: "Provides SQLite database operations including query execution, table management, and CRUD operations. Invoke when user needs to interact with SQLite databases or perform database tasks."
---

# SQLite MCP Server

This skill provides comprehensive SQLite database operations through MCP (Model Context Protocol) tools.

## Overview

The SQLite MCP Server enables interaction with SQLite databases, supporting:
- Database connection and management
- Table creation, modification, and deletion
- Data query and manipulation (CRUD operations)
- Schema inspection and analysis

## When to Invoke

Invoke this skill when:
- User needs to query or modify SQLite database data
- User wants to create or manage database tables
- User asks to perform database operations
- User needs to analyze database schema
- User requests data export or import

## Available Tools

### 1. Database Connection
- Connect to SQLite database files
- Manage multiple database connections
- Handle connection errors and validation

### 2. Table Operations
- Create tables with custom schemas
- Alter table structures
- Drop tables
- List all tables in database

### 3. Data Operations (CRUD)
- **Create**: Insert new records
- **Read**: Query data with filters and sorting
- **Update**: Modify existing records
- **Delete**: Remove records

### 4. Schema Inspection
- View table structure
- List columns and data types
- Check indexes and constraints
- Analyze table relationships

### 5. Query Execution
- Execute raw SQL queries
- Handle parameterized queries
- Manage transactions
- Return query results in structured format

## Usage Examples

### Query Data
```
User: "Show me all suppliers from the database"
→ Execute SELECT query on suppliers table
```

### Create Table
```
User: "Create a new table for tracking inventory"
→ Create inventory table with appropriate schema
```

### Insert Data
```
User: "Add a new product with ID P001, name 'Widget', price 29.99"
→ Insert record into products table
```

### Update Data
```
User: "Update the price of product P001 to 34.99"
→ Update record in products table
```

### Delete Data
```
User: "Remove the order with ID 12345"
→ Delete record from orders table
```

## Best Practices

1. **Always validate** user input before executing queries
2. **Use parameterized queries** to prevent SQL injection
3. **Handle errors gracefully** and provide clear error messages
4. **Use transactions** for multi-step operations
5. **Close connections** after operations complete
6. **Provide feedback** on operation success/failure

## Error Handling

The skill handles common SQLite errors:
- Database file not found
- Permission issues
- SQL syntax errors
- Constraint violations
- Connection failures

## Security Considerations

- Validate all user inputs
- Use prepared statements
- Restrict file system access
- Implement proper error messages
- Avoid exposing sensitive data

## Configuration

The MCP Server can be configured with:
- Database file path
- Connection timeout settings
- Query timeout limits
- Maximum result set size
- Logging level
