/**
 * pages/index/index.js
 * 课表主页面
 * 
 * 主要功能：
 * 1. 显示课表网格和课程信息。
 * 2. 支持按周切换查看课程。
 * 3. 支持添加和长按删除课程。
 * 4. 自动高亮当天日期和当前时间段。
 * 5. 动态计算布局，完美适配不同高度的手机屏幕。
 * 6. 自定义导航栏，美化顶部UI。
 */
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // --- 静态配置数据 ---
    totalWeeks: 20, // 总周数
    weekdays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    timeSections: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // 节数列表
    sectionTimes: [ // 每节课的详细时间
      { start: '08:30', end: '09:15' }, { start: '09:20', end: '10:05' },
      { start: '10:20', end: '11:05' }, { start: '11:10', end: '11:55' },
      { start: '14:30', end: '15:15' }, { start: '15:20', end: '16:05' },
      { start: '16:20', end: '17:05' }, { start: '17:10', end: '17:55' },
      { start: '19:30', end: '20:15' }, { start: '20:20', end: '21:05' },
      { start: '21:10', end: '21:55' }, { start: '22:00', end: '22:45' }
    ],
    colorList: [ // 课程卡片颜色池
      '#FFD180', '#A5D6A7', '#90CAF9', '#F48FB1',
      '#CE93D8', '#FFAB91', '#80CBC4'
    ],
    
    // --- 动态数据 ---
    currentWeek: 1,      // 当前选择的周数，默认为第1周
    courses: [],         // 从缓存读取或默认的原始课程数据
    coursesToRender: [], // 经过筛选和样式计算后，真正用于渲染的课程数据
    weekPickerRange: [], // 周数选择器的选项范围, e.g., ['第1周', '第2周', ...]
    dateList: [],        // 顶部的日期列表, e.g., ['08/01', '08/02', ...]
    currentMonth: 0,     // 左上角显示的月份数字
    leftColumnWidthStyle: '',
    
    // --- UI状态数据 ---
    todayIndex: -1,          // 今天是星期几(1-7)，用于高亮
    currentTimeIndex: -1,  // 当前时间所在的节次索引，用于高亮
    sectionHeight: 50,       // 每节课的动态高度，给一个默认值
    navBarStyle: '',         // 自定义导航栏的整体样式
    navContentStyle: '',     // 自定义导航栏内容区的样式
    pageContentPaddingTop: '', // 页面主体的顶部内边距，用于避开导航栏
    timer: null,             // 用于存放时间高亮定时器的ID
  },

/**
 * 生命周期函数--监听页面加载
 */
onLoad: function (options) {
  // --- 步骤 1: 执行所有无需等待UI渲染的初始化 ---
  this.calculateNavBarHeight(); // 计算自定义导航栏高度
  this.initWeekPicker();        // 初始化周数选择器
  this.initTodayHighlight();    // 初始化“今天”高亮的数据
  this.generateDateList();      // 生成顶部日期列表

  // --- 步骤 2: 加载课程数据 ---
  const storedCourses = wx.getStorageSync('courses') || this.getDefaultCourses();
  this.setData({ courses: storedCourses });

  // --- 步骤 3: 首次渲染UI骨架 ---
  // 此刻，使用默认的 sectionHeight(50) 和自适应的列宽来渲染
  this.processCourses(storedCourses);

  // --- 步骤 4: 启动定时器 ---
  this.startTimer();

  // --- 步骤 5: 在UI渲染完成后，查询真实布局尺寸并二次渲染 ---
  // 使用 setTimeout 确保查询时 DOM 已经稳定
  setTimeout(() => {
    const query = wx.createSelectorQuery();
    // 同时查询 time-cell 的高度 和 time-column 的宽度
    query.select('.time-cell').boundingClientRect();
    query.select('.time-column').boundingClientRect();
    query.exec((res) => {
      
      // -- a. 处理高度 --
      const newHeight = res && res[0] ? res[0].height : 0;
      if (newHeight && newHeight !== this.data.sectionHeight) {
        console.log('获取到动态高度:', newHeight);
        // 更新高度，并触发一次使用新高度的渲染
        this.setData({ sectionHeight: newHeight }, () => {
          this.processCourses(this.data.courses);
        });
      } else if (!newHeight) {
        console.error('获取 .time-cell 高度失败！');
      }
      
      // -- b. 处理宽度 --
      const newWidth = res && res[1] ? res[1].width : 0;
      if (newWidth) {
        console.log('获取到动态宽度:', newWidth);
        // 只更新宽度，这不会触发课程的重新计算，只会让 WXML 的 style 生效
        this.setData({
          leftColumnWidthStyle: `width: ${newWidth}px;`
        });
      } else {
        console.error('获取 .time-column 宽度失败！');
      }

    });
  }, 200); // 稍微增加延迟，确保在复杂页面也能查询成功
},
  
  /**
   * 生命周期函数--监听页面卸载
   * 清理定时器，防止内存泄漏。
   */
  onUnload: function () {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  /******************** 页面初始化函数 ********************/

  /**
   * 1. 计算自定义导航栏的高度，适配各种机型
   */
  calculateNavBarHeight: function() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navContentHeight = menuButtonInfo.height + (menuButtonInfo.top - statusBarHeight) * 2;
    const navBarHeight = statusBarHeight + navContentHeight;

    this.setData({
      navBarStyle: `height: ${navBarHeight}px;`,
      navContentStyle: `height: ${navContentHeight}px; padding-top: ${statusBarHeight}px;`,
      pageContentPaddingTop: `padding-top: ${navBarHeight}px;`
    });
  },

  /**
   * 2. 初始化周数选择器的范围
   */
  initWeekPicker: function() {
    const weekPickerRange = Array.from({ length: this.data.totalWeeks }, (v, i) => `第 ${i + 1} 周`);
    this.setData({ weekPickerRange: weekPickerRange });
  },

  /**
   * 3. 初始化“今天”高亮所需的数据
   */
  initTodayHighlight: function() {
    let day = new Date().getDay();
    day = day === 0 ? 7 : day; // 将周日(0)映射为7
    this.setData({ todayIndex: day });
  },

  /**
   * 4. 生成顶部日期列表 (MM/DD格式)
   */
  generateDateList: function() {
    const dateList = [];
    const now = new Date();
    const currentMonthNumber = now.getMonth() + 1;
    const padZero = num => (num < 10 ? '0' + num : num);

    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      const formattedDate = `${padZero(date.getMonth() + 1)}/${padZero(date.getDate())}`;
      dateList.push(formattedDate);
    }
    this.setData({ currentMonth: currentMonthNumber, dateList: dateList });
  },

  /**
   * 5. 获取默认课程数据 (当缓存为空时使用)
   */
  getDefaultCourses: function() {
    // 把默认课程数据封装成一个函数，让 data 部分更干净
    return [
      { teacher: '陈佳', name: '操作系统原理与实践', weeks: [1,2,3,4,5,6,7,8,9,10,11], day: 1, start: 5, sections: 2, location: '第二教学楼403' },
      { teacher: '姜玲', name: '综合体育', weeks: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], day: 1, start: 7, sections: 2, location: '操场' },
      { teacher: '曹银忠', name: '大国兴衰史', weeks: [1,2,3,4,5,6,7,8,9,10,11], day: 1, start: 9, sections: 2, location: '第二教学楼105' },
      { teacher: '文军', name: '数据库原理及应用', weeks: [1,2,3,4,5,6,7,8], day: 2, start: 3, sections: 2, location: '第二教学楼206' },
      { teacher: '夏金祥', name: '计算机网络系统', weeks: [1,2,3,4,5,6,7,8,9,10,11], day: 2, start: 5, sections: 2, location: '第二教学楼206' },
      { teacher: '蔡萍', name: '考研学业英语', weeks: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17], day: 3, start: 1, sections: 2, location: '第二教学楼401' },
      { teacher: '陈佳', name: '操作系统原理与实践', weeks: [1,2,3,4,5,6,7,8,9,10], day: 3, start: 3, sections: 2, location: '第二教学楼403' },
      { teacher: '孙静翎', name: 'EDA软件设计II', weeks: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], day: 3, start: 5, sections: 2, location: '第二教学楼207' },
      { teacher: '文军', name: '数据库原理及应用', weeks: [1,2,3,4,5,6,7,8], day: 4, start: 3, sections: 2, location: '第二教学楼206' },
      { teacher: '孙静翎', name: 'EDA软件设计II', weeks: [9,10,11,12,13], day: 4, start: 3, sections: 2, location: '信软楼西303'},
      { teacher: '夏金祥', name: '计算机网络系统', weeks: [1,2,3,4,5,6,7,8,9,10], day: 4, start: 5, sections: 2, location: '第二教学楼206' },
      { teacher: '夏金祥', name: '计算机网络系统', weeks: [11,12], day: 4, start: 7, sections: 2, location: '信软楼西305' },
      { teacher: '陈佳', name: '操作系统原理与实践', weeks: [9,11], weekType: 'single', day: 4, start: 9, sections: 2, location: '信软楼400' },
      { teacher: '甘涛', name: '工业软件创新训练II', weeks: [1,2,3,4,5,6,7,8,9,10,11,12,13,14], day: 5, start: 2, sections: 2, location: '第三教学楼501' },
      { teacher: '陈佳', name: '操作系统原理与实践', weeks: [1,2,3,4,5,6,7,8,9,10], day: 5, start: 5, sections: 2, location: '第二教学楼403' },
      { teacher: '陈佳', name: '操作系统原理与实践', weeks: [1,2,3,4,5,6,7,8], day: 5, start: 7, sections: 2, location: '第二教学楼403' },
      { teacher: '戴瑞婷', name: '形势与政策', weeks: [12], day: 6, start: 3, sections: 2, location: '第二教学楼105' },
    ];
  },

  /******************** 核心渲染与计算函数 ********************/

  /**
   * 初始化课表渲染的总入口 (加载、切换周、增删改后都调用此函数)
   * 负责动态获取每节课的高度，并触发最终的课程渲染
   */
  initSchedule: function(courses) {
    // 1. 先用默认/上一次的高度渲染一次UI骨架
    this.processCourses(courses);

    // 2. 在UI渲染完成后，查询 time-cell 的实际高度
    wx.nextTick(() => {
      const query = wx.createSelectorQuery();
      query.select('.time-cell').boundingClientRect();
      query.exec((res) => {
        if (res && res[0] && res[0].height) {
          // 3. 如果获取到的高度与当前存储的不同，则更新
          if (res[0].height !== this.data.sectionHeight) {
            this.setData({ sectionHeight: res[0].height }, () => {
              // 4. 在setData的回调中，使用最准确的高度再次渲染课程卡片
              this.processCourses(courses);
            });
          }
        }
      });
    });
  },

  /**
   * 处理课程数据 (筛选、计算样式)，并更新到页面
   * 这是一个纯函数，只负责计算和 setData
   */
  processCourses: function(courses) {
    const currentWeek = this.data.currentWeek;

    // 步骤1: 根据当前周数和单双周，过滤出需要显示的课程
    const filteredCourses = courses.filter(course => {
      if (!course.weeks || !course.weeks.includes(currentWeek)) return false;
      const isCurrentWeekSingle = currentWeek % 2 !== 0;
      if (course.weekType === 'single' && !isCurrentWeekSingle) return false;
      if (course.weekType === 'double' && isCurrentWeekSingle) return false;
      return true;
    });

    // 步骤2: 动态检测并标记冲突课程
    const conflictCheckedCourses = filteredCourses.map(course => {
      const conflicts = filteredCourses.filter(other => 
        course !== other && course.day === other.day && course.start === other.start
      );
      if (conflicts.length > 0) {
        const all = [course, ...conflicts].sort((a,b) => a.name.localeCompare(b.name));
        const order = all.findIndex(c => c === course) + 1;
        return { ...course, conflict: true, total: conflicts.length + 1, order };
      }
      return { ...course, conflict: false };
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    // 步骤3: 计算每个课程卡片的具体样式
    const dayWidth = 100 / 7;
    const sectionHeight = this.data.sectionHeight;
    const processedCourses = conflictCheckedCourses.map((course, index) => {
      const top = (course.start - 1) * sectionHeight;
      const height = course.sections * sectionHeight;
      let width = dayWidth;
      let left = (course.day - 1) * dayWidth;
      
      if (course.conflict) {
        width = dayWidth / course.total;
        left = left + (course.order - 1) * width;
      }
      
      const styleStr = `left:${left}%;top:${top}px;width:${width}%;height:${height}px;background-color:${this.data.colorList[index % this.data.colorList.length]};z-index:${course.order || 1};`;
      
      return { ...course, styleStr };
    });

    // 步骤4: 更新到页面进行渲染
    this.setData({ coursesToRender: processedCourses });
  },

  /******************** 用户交互事件处理函数 ********************/

  /**
   * 切换周数
   */
  onWeekChange: function(event) {
    const newWeek = Number(event.detail.value) + 1;
    this.setData({ currentWeek: newWeek });
    this.initSchedule(this.data.courses); // 使用当前存储的原始课程数据重新渲染
  },

  /**
   * 点击课程卡片，显示详情
   */
  showCourseDetail: function(event) {
    // 这里需要注意，index 是 coursesToRender 数组中的索引，而不是原始 courses 的
    const renderIndex = event.currentTarget.dataset.courseIndex;
    const course = this.data.coursesToRender[renderIndex];
    wx.showModal({
      title: course.name,
      content: `教师: ${course.teacher}\n地点: ${course.location}\n周数: ${course.weeks.join(',')}\n时间: 周${this.data.weekdays[course.day-1]} 第${course.start}-${course.start + course.sections - 1}节`,
      showCancel: false,
      confirmText: '确定'
    });
  },

  /**
   * 长按课程卡片，删除课程
   */
  deleteCourse: function(event) {
    const renderIndex = event.currentTarget.dataset.courseIndex;
    const courseToDelete = this.data.coursesToRender[renderIndex];

    wx.showModal({
      title: '删除课程',
      content: `确定要删除“${courseToDelete.name}”吗？`,
      success: (res) => {
        if (res.confirm) {
          // 从原始 courses 数组中找到并删除这门课
          // 注意：不能直接用 renderIndex，因为它是筛选后的索引
          const originalIndex = this.data.courses.findIndex(item => item === courseToDelete);
          if (originalIndex > -1) {
            this.data.courses.splice(originalIndex, 1);
            const newCourses = this.data.courses;
            // 更新缓存和页面
            wx.setStorageSync('courses', newCourses);
            this.setData({ courses: newCourses });
            this.initSchedule(newCourses);
            wx.showToast({ title: '删除成功', icon: 'success' });
          }
        }
      }
    });
  },
  
  /**
   * 点击"+"按钮，跳转到添加课程页面
   */
  navigateToAddCourse: function() {
    wx.navigateTo({
      url: '/pages/add-course/add-course',
      events: {
        addCourse: (newCourse) => {
          const newCourses = [...this.data.courses, newCourse];
          // 更新缓存和页面
          wx.setStorageSync('courses', newCourses);
          this.setData({ courses: newCourses });
          this.initSchedule(newCourses);
        }
      }
    });
  },

  /******************** 定时器与高亮函数 ********************/

  /**
   * 启动定时器，每分钟更新一次时间高亮
   */
  startTimer: function() {
    this.updateCurrentTimeHighlight();
    const timer = setInterval(() => this.updateCurrentTimeHighlight(), 60000);
    this.setData({ timer: timer });
  },

  /**
   * 更新当前时间高亮的逻辑
   */
  updateCurrentTimeHighlight: function() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    let activeIndex = -1;

    for (let i = 0; i < this.data.sectionTimes.length; i++) {
      const section = this.data.sectionTimes[i];
      if (section.start && section.end) {
        const start = parseInt(section.start.split(':')[0]) * 60 + parseInt(section.start.split(':')[1]);
        const end = parseInt(section.end.split(':')[0]) * 60 + parseInt(section.end.split(':')[1]);
        if (currentTime >= start && currentTime <= end) {
          activeIndex = i;
          break;
        }
      }
    }

    if (activeIndex !== this.data.currentTimeIndex) {
      this.setData({ currentTimeIndex: activeIndex });
    }
  },

});