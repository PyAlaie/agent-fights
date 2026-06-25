# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.12.9

FROM --platform=linux/amd64 python:${PYTHON_VERSION}-slim

RUN mkdir /coderunner/

COPY coderunner/coderunner.py /coderunner/
COPY coderunner/wrapper.py /coderunner/
COPY coderunner/env_wrapper.py /coderunner/
COPY coderunner/BaseEnv.py /coderunner/
COPY coderunner/BaseWrapper.py /coderunner/
COPY coderunner/requirements.txt /coderunner/

WORKDIR /coderunner/
RUN pip install -r requirements.txt

CMD [ "/usr/local/bin/python3", "coderunner.py" ]
