# Module 4: টোকেনাইজেশন ও টেক্সট প্রসেসিং (Build BPE from Scratch)

কম্পিউটার আমাদের ভাষা বোঝে না, সে শুধু বোঝে সংখ্যা। তাই আমাদের টেক্সটকে সংখ্যায় রূপান্তর করতে হয়। এই প্রক্রিয়াকে বলা হয় **Tokenization**। আজ আমরা নিজের হাতে একটি টোকেনাইজার বানাবো।

## ১. টোকেনাইজেশন কী?
একটি বড় টেক্সটকে ছোট ছোট টুকরো (যেমন- শব্দ বা বর্ণ) করাকে টোকেনাইজেশন বলে।
*   **Word-level:** "আমি আম খাই" -> ["আমি", "আম", "খাই"]
*   **Subword (BPE):** বড় বা অজানা শব্দকে ভেঙে ছোট করা (যেমন- "Learning" -> ["Learn", "##ing"])।

---

## 💡 বাস্তব জীবনের উদাহরণ (Analogy)

মনে করুন আপনি একটি লেগো (Lego) প্রজেক্ট বানাচ্ছেন।
পুরো ট্রাক (Truck) হলো আপনার টেক্সট। আর ট্রাকের ছোট ছোট ব্লকগুলো হলো টোকেন। আপনি যত ছোট ব্লক ব্যবহার করবেন, তত বিচিত্র সব জিনিস বানাতে পারবেন। বিপিই (BPE) হলো সেই বুদ্ধিমান সিস্টেম যা সবচেয়ে বেশি ব্যবহৃত ব্লকগুলোকে একসাথে রাখে।

---

## 🧠 গাণিতিক ধারণা (Math Intuition)

**BPE (Byte Pair Encoding)** টোকেনাইজারের মূল মন্ত্র হলো **Frequency** বা পৌনঃপুনিকতা।
১. টেক্সটে সবচেয়ে বেশি বার পাশাপাশি বসা দুটি বর্ণ বা শব্দ খুঁজে বের করা হয়।
২. তাদের জোড়া লাগিয়ে একটি নতুন টোকেন বানানো হয়।
৩. এই প্রক্রিয়া ততক্ষণ চলে যতক্ষণ না দরকারি পরিমাণ টোকেন (Vocabulary) তৈরি হয়।

---

## 💻 কোড ইমপ্লিমেন্টেশন (BPE conceptually)

```python
import collections

# ১. টেক্সট ডেটাসেট
corpus = "hug pug hug pun bun"
words = corpus.split()

# ২. শব্দগুলোকে স্প্লিট করে ভোকাবুলারি তৈরি (Initial characters)
# আমরা শেষ প্রান্তে </w> যোগ করি শব্দ শেষ হওয়ার চিহ্ন হিসেবে
vocab = [" ".join(list(word)) + " </w>" for word in words]
print(f"শুরুতে ভোকাবুলারি: {vocab}")

# ৩. জোড়া (Pairs) খুঁজে বের করা এবং মার্জ (Merge) করা
def get_stats(vocab):
    pairs = collections.defaultdict(int)
    for word in vocab:
        symbols = word.split()
        for i in range(len(symbols)-1):
            pairs[symbols[i],symbols[i+1]] += 1
    return pairs

def merge_vocab(pair, v_in):
    v_out = []
    bigram = " ".join(pair)
    replacement = "".join(pair)
    for word in v_in:
        v_out.append(word.replace(bigram, replacement))
    return v_out

# ৫ বার মার্জ করে দেখা যাক
for i in range(5):
    pairs = get_stats(vocab)
    if not pairs: break
    best = max(pairs, key=pairs.get)
    vocab = merge_vocab(best, vocab)
    print(f"\nধাপ {i+1}, সেরা জোড়া: {best}")
    print(f"আপডেট ভোকাব: {vocab}")

```

---

## 📊 আউটপুট উদাহরণ (Output)

```text
ধাপ ১, সেরা জোড়া: ('u', 'g')
আপডেট ভোকাব: ['h ug </w>', 'p ug </w>', 'h ug </w>', 'p u n </w>', 'b u n </w>']

ধাপ ২, সেরা জোড়া: ('h', 'ug')
আপডেট ভোকাব: ['hug </w>', 'p ug </w>', 'hug </w>', 'p u n </w>', 'b u n </w>']
```

> [!TIP]
> **Subword Tokenization** কেন গুরুত্বপূর্ণ? কারণ এটি মডেলকে "Unknown" বা অজানা শব্দ হ্যান্ডেল করতে সাহায্য করে। যদি বড় শব্দ সরাসরি না পায়, তবে সে ছোট ছোট টোকেন দিয়ে তা গঠন করে নেয়।