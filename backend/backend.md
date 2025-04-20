# Backend API

The backend API is developed using the FastAPI framework.

## Development Process:

---

### Requirements:

Below softwares are required to start:

- Python > 3.x
- Poetry `For package management`
- Uvicorn `ASGI Server for running the application`

### Installation:

You should create a virtual environment by running this command `python -m venv ./backend/.venv`.

Once, you have created the virtual environment you can activate it using this:

#### Windows Activation:

`. .venv/Scripts/Activate.ps1` This is for PowerShell on Windows platforms.

#### Linux Activation:

`. .venv/Scripts/activate.bat` This is for Linux/MacOs.

After activation of the virtual environment you need to install the poetry by using the bellow command:

`pip install poetry`

You can check if the poetry is install by checking using : `poetry --version` which will give you something like this:

`Poetry (version 1.8.5)`

#### Installing dependencies using Poetry:

Now when the poetry is install you need to install the dependencies using `poetry install`.

### Starting Application

After installing the dependencies you can run the service by issuing the command `uvicorn app.main:app --port 8001 --reload`

Once the server is running navigate to `http://localhost:8001` and check the service is running. FastAPI also has a documentation system which can be accessed via `http://localhost:8001/docs`
