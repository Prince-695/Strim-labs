from setuptools import setup, find_packages

setup(
    name="strim-labs",
    version="0.1.0",
    description="STRIM Labs telemetry and runtime API discovery middleware for Python",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    packages=find_packages(),
    author="STRIM Labs Team",
    author_email="support@strimlabs.com",
    url="https://strimlabs.com",
    license="MIT",
    python_requires=">=3.8",
)
