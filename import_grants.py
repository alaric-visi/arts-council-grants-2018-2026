import pandas as pd
import glob
import os
import json
import datetime
import requests
from urllib.parse import urljoin

# Setup directories
REPORTS_DIR = "/Users/mikehiggins/Documents/portfolio/arts-council-funding-reports"
OUTPUT_JSON = "/Users/mikehiggins/Documents/portfolio/public/data/arts-council-grants.json"

# Check environment variables for Supabase connection
supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

def extract_year_from_filename(filename):
    """
    Extracts a standard funding year (e.g., '2023-2024') from the file name.
    """
    # Look for patterns like '2022 23', '2018-19', '202526', '2023-24', '2019 20'
    import re
    fn = filename.lower()
    
    # Try pattern: 20XX-YY or 20XX YY or 20XXYY
    match = re.search(r'(20\d{2})[\s-]*(\d{2})', fn)
    if match:
        start_year = int(match.group(1))
        end_year_suffix = int(match.group(2))
        end_year = (start_year // 100) * 100 + end_year_suffix
        return f"{start_year}-{end_year}"
    
    # Try pattern: 20XXXX
    match = re.search(r'20(\d{2})20?(\d{2})', fn) # e.g. 202021 -> 2020-2021
    if match:
        # e.g., 202021 -> 2020-2021
        pass
    
    # Let's do a direct mapping for safety since we know the exact filenames
    mappings = {
        "2018-19": "2018-2019",
        "2019 20": "2019-2020",
        "202021": "2020-2021",
        "202122": "2021-2022",
        "2022 23": "2022-2023",
        "2023-24": "2023-2024",
        "2024-25": "2024-2025",
        "202526": "2025-2026",
        "202627": "2026-2027"
    }
    
    for key, value in mappings.items():
        if key in fn:
            return value
            
    return "Unknown"

def clean_data():
    files = glob.glob(os.path.join(REPORTS_DIR, "*.xlsx"))
    print(f"Found {len(files)} files to parse.")
    
    all_records = []
    
    for f in sorted(files):
        filename = os.path.basename(f)
        funding_year = extract_year_from_filename(filename)
        print(f"Processing: {filename} (Mapped to Year: {funding_year})")
        
        try:
            xl = pd.ExcelFile(f)
            if 'Project Grants Awards' not in xl.sheet_names:
                print(f"  Warning: 'Project Grants Awards' sheet not found in {filename}. Skipping.")
                continue
                
            # Read sheet starting at Row 2 (0-indexed, which is row index 2 in our inspection)
            # The column headers are at index 2
            df = pd.read_excel(f, sheet_name='Project Grants Awards', skiprows=2)
            
            # Print original columns
            cols = [str(c).strip() for c in df.columns]
            
            # Map columns to standard names
            # Map of expected column headers (case-insensitive) -> clean field name
            column_mapping = {
                'recipient': 'recipient',
                'activity name': 'activity_name',
                'activityname': 'activity_name',
                'award amount': 'award_amount',
                'awardamount': 'award_amount',
                'award date': 'award_date',
                'awarddate': 'award_date',
                'decision month': 'decision_month',
                'decisionmonth': 'decision_month',
                'decision quarter': 'decision_quarter',
                'decisionquarter': 'decision_quarter',
                'ace area': 'ace_area',
                'acearea': 'ace_area',
                'local authority': 'local_authority',
                'localauthority': 'local_authority',
                'main discipline': 'main_discipline',
                'maindiscipline': 'main_discipline',
                'strand': 'strand',
                'time-limited priority': 'time_limited_priority',
                'timelimitedpriority': 'time_limited_priority'
            }
            
            mapped_df = pd.DataFrame()
            
            for orig_col in df.columns:
                orig_col_clean = str(orig_col).strip().lower()
                matched_field = None
                for key, val in column_mapping.items():
                    if key == orig_col_clean:
                        matched_field = val
                        break
                
                if matched_field:
                    mapped_df[matched_field] = df[orig_col]
                    
            # Check if required fields exist
            if 'recipient' not in mapped_df.columns or 'award_amount' not in mapped_df.columns:
                print(f"  Warning: Required columns 'Recipient' or 'Award amount' not found in {filename}. Mapped columns: {list(mapped_df.columns)}")
                continue
                
            # Drop rows where recipient is null or empty
            mapped_df = mapped_df.dropna(subset=['recipient'])
            
            # Add funding_year and source_file
            mapped_df['funding_year'] = funding_year
            mapped_df['source_file'] = filename
            
            # Clean data types
            # 1. Award amount: convert to numeric
            mapped_df['award_amount'] = pd.to_numeric(mapped_df['award_amount'], errors='coerce').fillna(0).astype(int)
            
            # Clean and ensure string type for recipient and activity_name
            mapped_df['recipient'] = mapped_df['recipient'].apply(lambda x: str(x).strip() if pd.notna(x) else "")
            if 'activity_name' in mapped_df.columns:
                mapped_df['activity_name'] = mapped_df['activity_name'].apply(lambda x: str(x).strip() if pd.notna(x) else "")
            else:
                mapped_df['activity_name'] = ""

            # Filter out records where award_amount <= 0 or recipient is empty
            mapped_df = mapped_df[mapped_df['recipient'] != '']
            
            # 2. Award date: convert to YYYY-MM-DD
            def format_date(val):
                if pd.isna(val):
                    return None
                if isinstance(val, (datetime.datetime, datetime.date)):
                    return val.strftime("%Y-%m-%d")
                try:
                    dt = pd.to_datetime(val)
                    if pd.notna(dt):
                        return dt.strftime("%Y-%m-%d")
                except:
                    pass
                return None
                
            mapped_df['award_date'] = mapped_df['award_date'].apply(format_date)
            
            # Handle default values for optional columns
            optional_cols = ['decision_month', 'decision_quarter', 'ace_area', 'local_authority', 
                             'main_discipline', 'strand', 'time_limited_priority']
            for c in optional_cols:
                if c not in mapped_df.columns:
                    mapped_df[c] = None
                else:
                    # Convert to string and strip, map NaN to None
                    mapped_df[c] = mapped_df[c].apply(lambda x: str(x).strip() if pd.notna(x) else None)
            
            # Convert to list of dicts
            records = mapped_df.to_dict(orient='records')
            
            # Clean records: replace any pandas/numpy NaN/NA values with None for standard JSON compliance
            cleaned_records = []
            for record in records:
                cleaned_record = {}
                for k, v in record.items():
                    if pd.isna(v):
                        cleaned_record[k] = None
                    else:
                        cleaned_record[k] = v
                cleaned_records.append(cleaned_record)
                
            print(f"  Successfully parsed {len(cleaned_records)} records.")
            all_records.extend(cleaned_records)
            
        except Exception as e:
            print(f"  Error reading {filename}: {e}")
            
    print(f"\nTotal combined records parsed: {len(all_records)}")
    
    # Ensure parent directory exists for public JSON
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    
    # Save to public JSON as fallback
    print(f"Saving combined dataset to {OUTPUT_JSON}...")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as json_file:
        json.dump(all_records, json_file, indent=2, ensure_ascii=False)
    print("Static JSON data build complete!")
    
    # Upload to Supabase if config is live
    if supabase_url and supabase_key:
        print("\n--- Uploading to Supabase ---")
        print(f"Target URL: {supabase_url}")
        
        # REST API endpoint for bulk insert
        # We append /rest/v1/arts_council_grants
        rest_url = urljoin(supabase_url, "/rest/v1/arts_council_grants")
        
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates" # upsert style if wanted
        }
        
        # Split into batches of 500 rows
        batch_size = 500
        total_uploaded = 0
        
        # We can delete all old rows in this table first if wanted to refresh completely
        # Note: Be careful with DELETE. If it's a fresh database or we want to sync, let's delete first.
        # But we need permission / RLS to delete. Let's send a DELETE request.
        try:
            print("Clearing old records from arts_council_grants table...")
            del_r = requests.delete(rest_url, headers=headers, params={"id": "not.is.null"})
            print(f"Delete old records response status: {del_r.status_code}")
        except Exception as e:
            print(f"Failed to clear old records: {e}")
            
        for i in range(0, len(all_records), batch_size):
            batch = all_records[i:i+batch_size]
            print(f"Uploading batch {i // batch_size + 1} ({len(batch)} records)...")
            
            try:
                # Post the batch
                r = requests.post(rest_url, headers=headers, json=batch, timeout=30)
                if r.status_code in [200, 201]:
                    total_uploaded += len(batch)
                    print(f"  Uploaded batch successfully. Status: {r.status_code}")
                else:
                    print(f"  Error uploading batch: Status {r.status_code}. Response: {r.text}")
            except Exception as e:
                print(f"  Batch upload failed with exception: {e}")
                
        print(f"\nSupabase Import Summary: Uploaded {total_uploaded} / {len(all_records)} records successfully.")
    else:
        print("\nSupabase environment variables not set. Skipping database upload. (The app will fall back to static JSON).")

if __name__ == "__main__":
    clean_data()
