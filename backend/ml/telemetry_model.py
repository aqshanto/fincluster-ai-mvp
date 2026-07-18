import numpy as np
from sklearn.linear_model import LogisticRegression

class ThermalPredictor:
    def __init__(self):
        # একটি ডামি ট্রেইনড লজিস্টিক রিগ্রেশন মডেল (Load এবং Temp-এর ওপর ভিত্তি করে ক্র্যাশ প্রেডিকশন)
        self.model = LogisticRegression()
        # Training Data: [Load (%), Temp (°C)]
        X_train = np.array([
            [20, 30], [40, 45], [50, 55], [60, 60], # Normal cases (0)
            [75, 76], [80, 82], [90, 88], [95, 96]  # Overheating/Crash warning cases (1)
        ])
        y_train = np.array([0, 0, 0, 0, 1, 1, 1, 1])
        self.model.fit(X_train, y_train)

    def predict_overheat_risk(self, load: float, temp: float) -> bool:
        """
        রিটার্ন True যদি নোডটি ওভারহিট বা ক্র্যাশ করার ঝুঁকিতে থাকে।
        """
        prediction = self.model.predict([[load, temp]])
        return bool(prediction[0] == 1)

# সিঙ্গেলটন ইন্সট্যান্স
thermal_ml = ThermalPredictor()