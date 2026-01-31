# Mock checkbox variables for testing

checkbox1 = 0 # [CB]:1|0
if checkbox1:
    file = "exam.txt"
else :
    file = "example.txt"

print(f"File: {file}")

file = "text.txt" # [CB]: "exam.txt"|"example.txt"|"text.txt"
myFlag = True # [CB]: True|False
if myFlag:
    print(f"File: {file}")
else:
    print("No file selected")