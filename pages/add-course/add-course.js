// pages/add-course/add-course.js
Page({
  data: {
    // 1. 为 picker 准备数据
    weekdays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    timeSections: Array.from({ length: 12 }, (v, i) => `第 ${i + 1} 节`),
    durations: Array.from({ length: 12 }, (v, i) => `${i + 1} 节课`),

    // 2. 用于存储用户选择的结果
    selectedWeekdayIndex: null,
    selectedTimeIndex: null,
    selectedDurationIndex: null,

    // 新增：用于存储 input 的值
    courseName: '',
    location: '',
  },

  // 3. picker 的事件处理函数
  onWeekdayChange: function(event) {
    console.log('选择的星期是', event.detail.value);
    this.setData({
      selectedWeekdayIndex: event.detail.value
    });
  },

  onTimeChange: function(event) {
    console.log('选择的开始节数是', event.detail.value);
    this.setData({
      selectedTimeIndex: event.detail.value
    });
  },

  onDurationChange: function(event) {
    console.log('选择的持续节数是', event.detail.value);
    this.setData({
      selectedDurationIndex: event.detail.value
    });
  },
    // --- 新增：input 的事件处理函数 ---
  onCourseNameInput: function(event) {
    this.setData({
      courseName: event.detail.value
    });
  },

  onLocationInput: function(event) {
    this.setData({
      location: event.detail.value
    });
  },
  // --- 保存按钮的逻辑 ---
  saveCourse: function() {
    // 1. 数据校验
    if (!this.data.courseName) {
      wx.showToast({ title: '请输入课程名称', icon: 'none' });
      return;
    }
    if (this.data.selectedWeekdayIndex === null) {
      wx.showToast({ title: '请选择上课星期', icon: 'none' });
      return;
    }

    // 2. 组装课程对象
    const newCourse = {
      name: this.data.courseName,
      location: this.data.location,
      day: Number(this.data.selectedWeekdayIndex) + 1, // picker返回的是索引（字符串），转成数字再+1
      start: Number(this.data.selectedTimeIndex) + 1,
      sections: Number(this.data.selectedDurationIndex) + 1,
    };

    // 3. 通过 EventChannel 将数据传回上一页
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.emit('addCourse', newCourse);

    // 4. 返回上一页
    wx.navigateBack();
  },
  
})