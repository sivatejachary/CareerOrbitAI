from sqlalchemy import Column, Integer, UniqueConstraint
from backend.app.database import Base

class JobCodeSequence(Base):
    __tablename__ = "job_code_sequences"

    year = Column(Integer, primary_key=True)
    current_val = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("year", name="uq_job_code_sequence_year"),
    )
