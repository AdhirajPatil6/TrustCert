import re
from datetime import datetime, timedelta

class AI_Condition_Parser:
    """
    Simulates an NLP service that converts natural language conditions 
    into structured JSON logic/Smart Contract parameters.
    """
    
    @staticmethod
    def parse_condition(text: str):
        text = text.lower()
        conditions = []
        
        # 1. Date/Time Parsing (Regex for "after <date>")
        # Matches: "release after 2026-06-15" or "after 15 june"
        date_pattern = r"after\s+(\d{4}-\d{2}-\d{2})"
        date_match = re.search(date_pattern, text)
        if date_match:
            date_str = date_match.group(1)
            # Add time condition
            conditions.append({
                "type": "time",
                "operator": ">",
                "value": date_str,
                "description": f"Release after {date_str}"
            })

        # 1b. Date/Time Parsing (Regex for "after <DD Month YYYY>")
        # Matches: "after 15 June 2026" or "after 15 june 2026"
        date_text_pattern = r"after\s+(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})"
        date_text_match = re.search(date_text_pattern, text)
        if date_text_match:
            day, month_str, year = date_text_match.groups()
            try:
                dt = datetime.strptime(f"{day} {month_str} {year}", "%d %B %Y")
                date_str = dt.strftime("%Y-%m-%d")
                conditions.append({
                    "type": "time",
                    "operator": ">",
                    "value": date_str,
                    "description": f"Release after {date_str}"
                })
            except ValueError:
                pass # Month name or format invalid
            
        # 2. Attendance Parsing (Regex for "attendance > X%")
        # Matches: "attendance > 75%" or "attendance > 80"
        att_pattern = r"attendance\s*>\s*(\d+)%?"
        att_match = re.search(att_pattern, text)
        if att_match:
            threshold = int(att_match.group(1))
            conditions.append({
                "type": "attendance",
                "operator": ">",
                "value": threshold,
                "description": f"Attendance greater than {threshold}%"
            })

        # 3. Approval/Signature Parsing (Regex for "approved by <role/name>")
        # Matches: "approved by faculty" or "mentor approves"
        if "approved by" in text or "approve" in text:
            # Extract basic role if present
            role = "faculty" # Default for now
            if "admin" in text: role = "admin"
            
            conditions.append({
                "type": "approval",
                "role": role,
                "count": 1,
                "description": f"Requires 1 approval from {role}"
            })
            
        # 4. Grade Parsing
        grade_pattern = r"grade\s*>\s*([a-zA-Z0-9]+)"
        grade_match = re.search(grade_pattern, text)
        if grade_match:
             conditions.append({
                "type": "grade",
                "operator": ">",
                "value": grade_match.group(1).upper(),
                "description": f"Grade better than {grade_match.group(1).upper()}"
            })

        return {
            "original_text": text,
            "parsed_conditions": conditions,
            "logic_hash": str(len(conditions)) + "rules" # Mock hash
        }
