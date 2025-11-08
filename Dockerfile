FROM python:3.13-slim

# Set the working directory in the container
WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

COPY pyproject.toml ./

# Install dependencies using uv instead of pip
RUN uv pip install --system --no-cache-dir .

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port that Gunicorn will listen on
EXPOSE 5000

# Specify the command to run the application via uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "4"]
