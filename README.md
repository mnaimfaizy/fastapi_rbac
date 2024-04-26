# Python FastAPI User Management Service

This is the user management micro service which will manage the Authentication and Authorization for all other services.

## Installation
***
### Requirements:
Below softwares are required to start:

* Python > 3.x
* Poetry `For package management`
* Uvicorn `ASGI Server for running the application`

If you would want to creat a virutual environment you can do it by running this command `python -m venv .venv`

### Starting Application

First you have to install the dependencies using `poetry install`
After installing the dependencies you can run the service by issuing the command `uvicorn app.main:app --port 8001 --reload` 

Once the server is running navigate to `http://localhost:8001` and check the service is running. FastAPI also has a documentation system which can be accessed via `http://localhost:8001/docs`